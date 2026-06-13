import { useState } from 'react';
import api from '../api/axios';

const Detection = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleRunDetection = async () => {
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            const res = await api.post('/alerts/detect');
            if (res.data.success) {
                setResult(res.data.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Echec de la detection');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem' }}>Moteur de detection des fraudes</h2>
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <h3>Analyse de detection</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Declencher le moteur pour analyser toutes les transactions.
                </p>
                <button
                    className="btn btn-primary"
                    onClick={handleRunDetection}
                    disabled={loading}
                    style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}
                >
                    {loading ? 'Analyse en cours...' : 'Detention de demarrage'}
                </button>

                {error && (
                    <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '0.5rem' }}>
                        {error}
                    </div>
                )}

                {result && (
                    <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: '0.5rem' }}>
                        <div style={{ color: '#22c55e', fontWeight: 'bold', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                            Detection Terminee
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="card" style={{ margin: 0 }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Transactions scorees</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{result.mlScored || 0}</div>
                            </div>
                            <div className="card" style={{ margin: 0 }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Anomalies detectees</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>{result.mlAnomalies || 0}</div>
                            </div>
                            <div className="card" style={{ margin: 0 }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Regles executees</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{result.rulesExecuted || 0}</div>
                            </div>
                            <div className="card" style={{ margin: 0 }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Nouvelles alertes</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{result.newAlerts || 0}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Detection;