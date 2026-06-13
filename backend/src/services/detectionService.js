const { getSession } = require('../config/db');
const Rule = require('../models/Rule');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function callMLService(transaction) {
    try {
        const payload = {
            txId: transaction.txId || null,
            amount: parseFloat(transaction.amount) || 0,
            hour: transaction.date ? new Date(transaction.date.toString()).getHours() : 12,
        };
        const response = await fetch(`${ML_SERVICE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) throw new Error(`ML Service error: ${response.status}`);
        return await response.json();
    } catch (err) {
        console.warn(`⚠️  ML Service inaccessible: ${err.message}`);
        return null;
    }
}

async function saveMLScore(session, txId, mlResult) {
    try {
        await session.run(`
            MATCH (t:Transaction {txId: $txId})
            SET t.risk_score = $riskScore,
                t.risk_percent = $riskPercent,
                t.is_anomaly = $isAnomaly,
                t.ml_severity = $severity,
                t.ml_analyzed_at = datetime()
        `, { txId, riskScore: mlResult.risk_score, riskPercent: mlResult.risk_percent, isAnomaly: mlResult.is_anomaly, severity: mlResult.severity });

        if (mlResult.is_anomaly) {
            await session.run(`
                MATCH (t:Transaction {txId: $txId})
                WHERE NOT (t)-[:HAS_ALERT]->(:Alert {rule: 'ML_ANOMALY', txId: $txId})
                CREATE (a:Alert {
                    id: randomUUID(), rule: 'ML_ANOMALY', severity: $severity,
                    status: 'NEW', createdAt: datetime(),
                    description: 'IA Isolation Forest: score de risque ' + $riskPercent + '% — anomalie détectée'
                })
                CREATE (t)-[:HAS_ALERT]->(a)
            `, { txId, severity: mlResult.severity, riskPercent: mlResult.risk_percent });
        }
    } catch (err) {
        console.error(`Erreur ML score pour ${txId}:`, err.message);
    }
}

class DetectionService {

    static async initDefaultRules() {
        const rules = await Rule.getAll();
        if (rules.length > 0) return;
        console.log("Initializing default fraud rules...");

        await Rule.create('MONTANT_ELEVE', 'Transaction amount exceeds defined threshold', 'AMOUNT_THRESHOLD',
            `MATCH (t:Transaction) WHERE t.amount > $threshold AND NOT (t)-[:HAS_ALERT]->(:Alert {rule: 'MONTANT_ELEVE'})
            CREATE (a:Alert { id: randomUUID(), rule: 'MONTANT_ELEVE', severity: 'HIGH', status: 'NEW', createdAt: datetime(),
            description: 'Transaction amount ' + t.amount + ' exceeds threshold ' + $threshold })
            CREATE (t)-[:HAS_ALERT]->(a) RETURN count(a) as count`, 10000.0);

        await Rule.create('IP_PARTAGEE', 'IP address used by multiple users', 'SHARED_RESOURCE',
            `MATCH (ip:IP)<-[:FROM_IP]-(t:Transaction)<-[:PERFORMED]-(a:Account)
            WITH ip, count(distinct a) as accountCount, collect(t) as txs WHERE accountCount >= $threshold
            UNWIND txs as t MATCH (t) WHERE NOT (t)-[:HAS_ALERT]->(:Alert {rule: 'IP_PARTAGEE'})
            CREATE (al:Alert { id: randomUUID(), rule: 'IP_PARTAGEE', severity: 'CRITICAL', status: 'NEW', createdAt: datetime(),
            description: 'IP used by ' + accountCount + ' distinct accounts' })
            CREATE (t)-[:HAS_ALERT]->(al) RETURN count(al) as count`, 2);

        await Rule.create('TRANSACTIONS_RAPIDES', 'Multiple transactions in a short period', 'VELOCITY',
            `MATCH (a:Account)-[:PERFORMED]->(t:Transaction) WITH a, t
            MATCH (a)-[:PERFORMED]->(other:Transaction) WHERE other.txId <> t.txId
            AND abs(duration.inSeconds(t.date, other.date).seconds) < 600
            WITH t, count(other) as recentCount WHERE recentCount >= $threshold
            AND NOT (t)-[:HAS_ALERT]->(:Alert {rule: 'TRANSACTIONS_RAPIDES'})
            CREATE (al:Alert { id: randomUUID(), rule: 'TRANSACTIONS_RAPIDES', severity: 'MEDIUM', status: 'NEW', createdAt: datetime(),
            description: 'High velocity: ' + recentCount + ' transactions in short period' })
            CREATE (t)-[:HAS_ALERT]->(al) RETURN count(al) as count`, 5);

        await Rule.create('MULTI_COMPTES', 'Single device associated with multiple accounts', 'ENTITY_LINK',
            `MATCH (d:Device)<-[:FROM_DEVICE]-(t:Transaction)<-[:PERFORMED]-(a:Account)
            WITH d, count(distinct a) as accountsLinked WHERE accountsLinked >= $threshold
            MATCH (d)<-[:FROM_DEVICE]-(t2:Transaction) WHERE NOT (t2)-[:HAS_ALERT]->(:Alert {rule: 'MULTI_COMPTES'})
            CREATE (al:Alert { id: randomUUID(), rule: 'MULTI_COMPTES', severity: 'CRITICAL', status: 'NEW', createdAt: datetime(),
            description: 'Device linked to ' + accountsLinked + ' accounts' })
            CREATE (t2)-[:HAS_ALERT]->(al) RETURN count(al) as count`, 2);

        console.log("Default rules initialized.");
    }

    static async runDetection() {
        await this.initDefaultRules();

        const session = getSession();
        const rules = await Rule.getAll();
        const stats = { newAlerts: 0, rulesExecuted: 0, mlScored: 0, mlAnomalies: 0 };

        try {
            // ÉTAPE 1 : Règles Cypher
            console.log("🔍 Exécution des règles métier Cypher...");
            for (const rule of rules) {
                if (!rule.enabled) continue;
                let params = rule.parameters || {};
                if (rule.threshold !== undefined && rule.threshold !== null) params.threshold = rule.threshold;
                try {
                    const result = await session.run(rule.cypherQuery, params);
                    if (result.records.length > 0 && result.records[0].keys.includes('count')) {
                        stats.newAlerts += result.records[0].get('count').toNumber();
                    }
                    stats.rulesExecuted++;
                } catch (ruleErr) {
                    console.error(`Error executing rule ${rule.name}:`, ruleErr);
                }
            }
            console.log(`   ✓ ${stats.rulesExecuted} règles exécutées, ${stats.newAlerts} alertes créées`);

            // ÉTAPE 2 : Scoring IA
            console.log("🤖 Scoring IA (Isolation Forest)...");
            const txResult = await session.run(`
                MATCH (t:Transaction) WHERE t.risk_score IS NULL RETURN t LIMIT 500
            `);
            const transactions = txResult.records.map(r => r.get('t').properties);
            console.log(`   → ${transactions.length} transactions à scorer`);

            for (const tx of transactions) {
                const mlResult = await callMLService(tx);
                if (mlResult) {
                    const mlSession = getSession();
                    await saveMLScore(mlSession, tx.txId, mlResult);
                    await mlSession.close();
                    stats.mlScored++;
                    if (mlResult.is_anomaly) stats.mlAnomalies++;
                }
            }
            console.log(`   ✓ ${stats.mlScored} transactions scorées, ${stats.mlAnomalies} anomalies IA détectées`);

        } catch (err) {
            console.error("Detection Error:", err);
            throw err;
        } finally {
            await session.close();
        }

        return stats;
    }
}

module.exports = DetectionService;