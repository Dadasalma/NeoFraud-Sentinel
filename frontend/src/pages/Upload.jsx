import { useState } from 'react';
import api from '../api/axios';
import { Upload as UploadIcon, CheckCircle, AlertCircle, Database, Brain, Bell, ChevronRight } from 'lucide-react';

const Upload = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);
    const [detectionStats, setDetectionStats] = useState(null);
    const [currentStep, setCurrentStep] = useState(0); // 0=idle, 1=upload, 2=detect, 3=done

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setMessage(null);
        setError(null);
        setStats(null);
        setDetectionStats(null);
        setCurrentStep(0);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setCurrentStep(1);
        setError(null);

        try {
            // ÉTAPE 1 — Ingestion CSV
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                setStats(res.data.data);
                setMessage(`✅ ${res.data.data.processed} transactions ingérées dans Neo4j`);
                setCurrentStep(2);

                // ÉTAPE 2 — Détection IA automatique
                setDetecting(true);
                try {
                    const detRes = await api.post('/detection/run');
                    if (detRes.data.success) {
                        setDetectionStats(detRes.data.stats);
                        setCurrentStep(3);
                    }
                } catch (detErr) {
                    console.warn('Detection auto failed:', detErr);
                    setCurrentStep(3);
                } finally {
                    setDetecting(false);
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Échec de l\'upload');
            setCurrentStep(0);
        } finally {
            setUploading(false);
        }
    };

    const steps = [
        { id: 1, icon: <UploadIcon size={20} />, label: 'Upload CSV', sublabel: 'Réception données bancaires' },
        { id: 2, icon: <Database size={20} />, label: 'Ingestion Neo4j', sublabel: 'Import dans le graphe' },
        { id: 3, icon: <Brain size={20} />, label: 'Analyse IA', sublabel: 'Isolation Forest scoring' },
        { id: 4, icon: <Bell size={20} />, label: 'Alertes générées', sublabel: 'Résultats disponibles' },
    ];

    const getStepStatus = (stepId) => {
        if (currentStep === 0) return 'idle';
        if (stepId < currentStep) return 'done';
        if (stepId === currentStep) return 'active';
        return 'idle';
    };

    const stepColor = (status) => {
        if (status === 'done') return '#22c55e';
        if (status === 'active') return '#6366f1';
        return 'rgba(255,255,255,0.2)';
    };

    return (
        <div style={{ maxWidth: '750px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ margin: 0, color: 'white' }}>🏦 Agent d'Ingestion Bancaire</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Importez les données bancaires CSV — l'IA analyse automatiquement les transactions
                </p>
            </div>

            {/* Flux visuel */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '12px', marginBottom: '2rem' }}>
                {steps.map((step, idx) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                backgroundColor: `${stepColor(getStepStatus(step.id))}22`,
                                border: `2px solid ${stepColor(getStepStatus(step.id))}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: stepColor(getStepStatus(step.id)),
                                marginBottom: '0.5rem',
                                transition: 'all 0.3s ease'
                            }}>
                                {getStepStatus(step.id) === 'done' ? <CheckCircle size={20} /> : step.icon}
                            </div>
                            <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: '600', textAlign: 'center' }}>{step.label}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textAlign: 'center' }}>{step.sublabel}</span>
                        </div>
                        {idx < steps.length - 1 && (
                            <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                        )}
                    </div>
                ))}
            </div>

            {/* Upload Card */}
            <div className="card">
                <form onSubmit={handleUpload}>
                    <div style={{
                        border: `2px dashed ${file ? '#6366f1' : 'var(--border)'}`,
                        borderRadius: '0.75rem', padding: '3rem', textAlign: 'center',
                        marginBottom: '1.5rem', cursor: 'pointer', position: 'relative',
                        backgroundColor: file ? 'rgba(99,102,241,0.05)' : 'transparent',
                        transition: 'all 0.3s ease'
                    }}>
                        <input
                            type="file" accept=".csv" onChange={handleFileChange}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        />
                        <UploadIcon size={48} color={file ? '#6366f1' : 'var(--text-secondary)'} style={{ marginBottom: '1rem' }} />
                        <p style={{ margin: 0, fontWeight: 600, color: file ? '#a5b4fc' : 'white' }}>
                            {file ? `📄 ${file.name}` : 'Glissez ou cliquez pour sélectionner le fichier CSV'}
                        </p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                            Format : txId, amount, userId, date, ip, device, merchant...
                        </p>
                    </div>

                    {/* Messages */}
                    {message && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#22c55e', marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '0.5rem' }}>
                            <CheckCircle size={20} /> {message}
                        </div>
                    )}
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '0.5rem' }}>
                            <AlertCircle size={20} /> {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1rem' }} disabled={!file || uploading || detecting}>
                        {uploading ? '⏳ Ingestion en cours...' : detecting ? '🤖 Analyse IA en cours...' : '🚀 Lancer l\'ingestion & détection'}
                    </button>
                </form>
            </div>

            {/* Résultats */}
            {(stats || detectionStats) && (
                <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                    {stats && (
                        <div style={{ padding: '1.25rem', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: '10px' }}>
                            <div style={{ color: '#22c55e', fontWeight: '700', marginBottom: '0.75rem' }}>📥 Ingestion Neo4j</div>
                            <div style={{ color: 'white', fontSize: '2rem', fontWeight: 'bold' }}>{stats.processed}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>transactions importées</div>
                            {stats.errors > 0 && <div style={{ color: '#f97316', fontSize: '0.8rem', marginTop: '0.5rem' }}>⚠️ {stats.errors} erreurs</div>}
                        </div>
                    )}

                    {detectionStats && (
                        <div style={{ padding: '1.25rem', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid #6366f1', borderRadius: '10px' }}>
                            <div style={{ color: '#a5b4fc', fontWeight: '700', marginBottom: '0.75rem' }}>🤖 Résultats IA</div>
                            <div style={{ color: '#ef4444', fontSize: '2rem', fontWeight: 'bold' }}>{detectionStats.mlAnomalies}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>anomalies détectées</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>sur {detectionStats.mlScored} transactions scorées</div>
                        </div>
                    )}
                </div>
            )}

            {/* Lien vers alertes */}
            {currentStep === 3 && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid #6366f1', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ color: 'white', margin: '0 0 0.75rem 0' }}>✅ Analyse terminée ! Consultez les alertes générées.</p>
                    <a href="/alerts" className="btn btn-primary" style={{ display: 'inline-block', padding: '0.75rem 2rem' }}>
                        Voir les Alertes →
                    </a>
                </div>
            )}

        </div>
    );
};

export default Upload;