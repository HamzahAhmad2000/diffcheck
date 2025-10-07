import React, { useState, useEffect } from 'react';
import { responsePackageAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import Sidebar from '../common/Sidebar';
import '../../styles/fonts.css';
import '../../styles/AIChat.css';
import './AdminForms.css';
import './AdminTables.css';
import BLoading from './ui/BLoading';

const PurchaseResponsePackages = () => {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPackages = async () => {
            try {
                const response = await responsePackageAPI.getAvailablePackages();
                setPackages(response.data.packages);
                setLoading(false);
            } catch (error) {
                toast.error('Failed to fetch response packages.');
                setLoading(false);
            }
        };

        fetchPackages();
    }, []);

    if (loading) {
        return (
            <div className="page-container">
                <Sidebar />
                <div className="newmain-content33 admin-table-page">
                    <BLoading variant="page" label="Loading response packages..." />
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Sidebar />
            <div className="newmain-content33 admin-table-page">
                <div className="table-header-container">
                    <div className="table-header">
                        <h1 className="chat-title">Purchase Additional Responses</h1>
                        <p className="chat-subtitle">Buy extra survey responses for your business</p>
                    </div>
                </div>
                <div className="packages-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    {packages.map(pkg => (
                        <div key={pkg.id} className="admin-card" style={{ padding: '20px' }}>
                            <h3 style={{ marginTop: 0 }}>{pkg.name}</h3>
                            {pkg.description && <p style={{ color: '#6b7280' }}>{pkg.description}</p>}
                            <p><strong>Responses:</strong> {pkg.responses.toLocaleString()}</p>
                            <p><strong>Price:</strong> ${(pkg.price / 100).toFixed(2)}</p>
                            <button className="newform-button primary" style={{ width: '100%' }}>Purchase</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PurchaseResponsePackages; 