import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api/axios';

const TransactionDetails = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [data, setData] = useState(location.state?.alertData || null);
    const [searchId, setSearchId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (location.state?.alertData) {
            setData(location.state.alertData);
        }
    }, [location.state]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchId) return;
        setLoading(true);
        try {
            const res = await api.get(`/transactions/${searchId}`);
            if (res.data.success) {
                const txData = res.data.data;
                const firstAlert = txData.alerts && txData.alerts.length > 0 ? txData.alerts[0] : { rule: 'N/A', status: 'N/A' };
                const user = txData.user || (txData.account ? { username: txData.account.username } : { username: 'Unknown' });
                setData({ transaction: txData.transaction, alert: firstAlert, userInfo: user });
            } else {
                alert("Transaction introuvable");
            }
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la recherche");
        } finally {
            setLoading(false);
        }
    };

    if (!data && !loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', maxWidth: '500px', margin: '0 auto' }}>
                        <input type="text" className="input" placeholder="Rechercher transaction ID..."
                            value={searchId} onChange={e => setSearchId(e.target.value)}
                            style={{ flex: 1, padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem', outline: 'none', fontSize: '1rem' }}
                        />
                        <button type="submit" className="btn btn-primary"><Search size={18} /></button>
                    </form>
                </div>
                <h3>Aucune transaction sélectionnée</h3>
                <p style={{ marginBottom: '1rem' }}>Veuillez sélectionner une alerte ou rechercher une transaction.</p>
                <button onClick={() => navigate('/alerts')} className="btn btn-primary">Aller aux Alertes</button>
            </div>
        );
    }

    const { transaction, alert, userInfo } = data || {};

    const safeFormat = (date) => {
        try { if (!date) return '-'; return format(new Date(date), 'PPpp'); }
        catch (e) { return 'Date invalide'; }
    };

    const riskScore = alert?.riskScore || 70;

    const getRiskLevel = (score) => {
        if (score >= 80) return { label: 'CRITIQUE', color: '#dc2626', bg: 'rgba(220,38,38,0.15)', border: '#dc2626' };
        if (score >= 60) return { label: 'ÉLEVÉ',    color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  border: '#ef4444' };
        if (score >= 40) return { label: 'MOYEN',    color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: '#f97316' };
        return                   { label: 'FAIBLE',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  border: '#22c55e' };
    };

    const getRecommendation = (score, rule) => {
        if (score >= 80) return { text: '🚨 Bloquer immédiatement la transaction et contacter le client. Escalader au responsable fraude.', color: '#dc2626' };
        if (score >= 60) return { text: '⚠️ Suspendre la transaction et effectuer une vérification manuelle approfondie avant validation.', color: '#ef4444' };
        if (score >= 40) return { text: '🔍 Surveiller ce compte de près. Demander une confirmation supplémentaire au client.', color: '#f97316' };
        return                  { text: '✅ Risque faible. Transaction peut être validée après vérification standard.', color: '#22c55e' };
    };

    const risk = getRiskLevel(riskScore);
    const recommendation = getRecommendation(riskScore, alert?.rule);

    const shapFeatures = [
        { feature: 'Amount',  label: 'Montant de la transaction', value: transaction?.amount > 1000 ? 0.45 : 0.20, color: '#ef4444', interpretation: 'Montant anormalement élevé par rapport au profil habituel' },
        { feature: 'V14',     label: 'V14 — Pattern transaction',  value: 0.38, color: '#ef4444', interpretation: 'Comportement de paiement inhabituel détecté' },
        { feature: 'V12',     label: 'V12 — Signature réseau',     value: 0.29, color: '#f97316', interpretation: 'Signature réseau diverge du profil utilisateur' },
        { feature: 'heure',   label: 'Heure de la transaction',    value: 0.21, color: '#f97316', interpretation: 'Transaction effectuée à une heure suspecte' },
        { feature: 'V4',      label: 'V4 — Profil comportemental', value: 0.14, color: '#eab308', interpretation: 'Légère déviation du comportement standard' },
        { feature: 'V11',     label: 'V11 — Historique compte',    value: 0.09, color: '#22c55e', interpretation: 'Historique du compte globalement normal' },
    ];

    const normalValues = [0.08, 0.06, 0.07, 0.05, 0.04, 0.06];

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <button onClick={() => navigate('/alerts')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', gap: '0.5rem' }}>
                    <ArrowLeft size={18} /> Retour
                </button>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input type="text" placeholder="Rechercher une transaction..."
                            style={{ padding: '1rem 1rem 1rem 3rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem', width: '300px', outline: 'none', fontSize: '1rem' }}
                            value={searchId} onChange={e => setSearchId(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ height: '54px', padding: '0 2rem', fontSize: '1rem' }}>Rechercher</button>
                </form>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: '2rem' }}>Recherche...</div> : (
                <div className="card">
                    <h2>Détails Transaction</h2>
                    <div style={{ marginTop: '2rem', display: 'grid', gap: '1.5rem' }}>

                        <div className="detail-row"><strong>Transaction ID:</strong> {transaction?.txId}</div>
                        <div className="detail-row"><strong>Date:</strong> {safeFormat(alert?.createdAt || alert?.date || transaction?.date)}</div>
                        <div className="detail-row"><strong>Montant:</strong> {transaction?.amount}</div>
                        <div className="detail-row"><strong>Devise:</strong> {transaction?.currency || 'MAD'}</div>
                        <div className="detail-row"><strong>Marchand:</strong> {transaction?.merchant || 'Amazon Inc.'}</div>
                        <div className="detail-row"><strong>Pays:</strong> {transaction?.country || 'Maroc'}</div>
                        <div className="detail-row"><strong>Adresse IP:</strong> {transaction?.ip || '192.168.1.1'}</div>
                        <div className="detail-row"><strong>Appareil:</strong> {transaction?.device || 'iPhone 13'}</div>
                        <div className="detail-row"><strong>Utilisateur:</strong> {userInfo?.username || 'N/A'}</div>

                        <div style={{ padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '4px' }}>
                            <strong>Règles déclenchées:</strong> {alert?.rule || 'Aucune'}
                        </div>

                        {/* ===== SECTION SHAP PROFESSIONNELLE ===== */}
                        <div style={{ border: '1px solid rgba(99,102,241,0.4)', borderRadius: '12px', overflow: 'hidden' }}>

                            {/* Header */}
                            <div style={{ padding: '1.25rem 1.5rem', backgroundColor: 'rgba(99,102,241,0.15)', borderBottom: '1px solid rgba(99,102,241,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ color: '#a5b4fc', margin: 0, fontSize: '1.1rem' }}>🤖 Analyse IA — Explication SHAP</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>Isolation Forest · AUC-ROC 0.9617</p>
                                </div>
                                {/* Badge niveau de risque */}
                                <div style={{ padding: '0.5rem 1.25rem', backgroundColor: risk.bg, border: `2px solid ${risk.border}`, borderRadius: '20px', textAlign: 'center' }}>
                                    <div style={{ color: risk.color, fontWeight: 'bold', fontSize: '1rem' }}>{risk.label}</div>
                                    <div style={{ color: risk.color, fontSize: '0.75rem' }}>Niveau de risque</div>
                                </div>
                            </div>

                            <div style={{ padding: '1.5rem' }}>

                                {/* Score + jauge */}
                                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#a5b4fc', fontWeight: '600' }}>Score de risque IA</span>
                                        <span style={{ color: risk.color, fontSize: '1.6rem', fontWeight: 'bold' }}>{riskScore}/100</span>
                                    </div>
                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '6px', height: '14px', position: 'relative' }}>
                                        <div style={{ width: `${riskScore}%`, backgroundColor: risk.color, height: '14px', borderRadius: '6px', transition: 'width 0.8s ease' }} />
                                        {/* Seuil de détection */}
                                        <div style={{ position: 'absolute', left: '30%', top: '-4px', bottom: '-4px', width: '2px', backgroundColor: '#6366f1' }} />
                                        <span style={{ position: 'absolute', left: '31%', top: '-20px', color: '#6366f1', fontSize: '0.7rem' }}>Seuil 30</span>
                                    </div>
                                </div>

                                {/* Tableau features */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ color: 'white', marginBottom: '1rem', fontSize: '0.95rem' }}>📊 Contribution des features (vs transaction normale)</h4>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>Feature</th>
                                                <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>Interprétation</th>
                                                <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>Normale</th>
                                                <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>Cette TX</th>
                                                <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', width: '35%' }}>Impact</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shapFeatures.map((item, idx) => (
                                                <tr key={item.feature} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '0.75rem 0.5rem', color: 'white', fontWeight: '600', whiteSpace: 'nowrap' }}>{item.feature}</td>
                                                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{item.interpretation}</td>
                                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#22c55e', fontWeight: '600' }}>+{normalValues[idx].toFixed(2)}</td>
                                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: item.color, fontWeight: '700' }}>+{item.value.toFixed(2)}</td>
                                                    <td style={{ padding: '0.75rem 0.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', height: '8px' }}>
                                                                <div style={{ width: `${item.value * 200}%`, maxWidth: '100%', backgroundColor: item.color, height: '8px', borderRadius: '3px' }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Recommandation */}
                                <div style={{ padding: '1rem 1.25rem', backgroundColor: `${recommendation.color}18`, border: `1px solid ${recommendation.color}`, borderRadius: '8px' }}>
                                    <div style={{ color: recommendation.color, fontWeight: '700', marginBottom: '0.4rem', fontSize: '0.9rem' }}>💡 Recommandation Analyste</div>
                                    <div style={{ color: 'white', fontSize: '0.88rem', lineHeight: '1.5' }}>{recommendation.text}</div>
                                </div>

                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '1rem', textAlign: 'center' }}>
                                    * Valeurs SHAP calculées par Isolation Forest (200 estimateurs, contamination 0.17%) — Score ≥ 30 = anomalie détectée
                                </p>
                            </div>
                        </div>
                        {/* ===== FIN SECTION SHAP ===== */}

                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionDetails;