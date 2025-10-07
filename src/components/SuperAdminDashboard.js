import React from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar' // Assuming Sidebar is in ../components
import './SuperAdminDashboard.css' // Import the updated CSS file

const SuperAdminDashboard = () => {
    const navigate = useNavigate()

    const handleNavigation = (path) => {
        if (path) {
            navigate(path)
        } else {
            console.warn('Navigation path is undefined for this action.')
            alert('This feature is coming soon!')
        }
    }

    const actionGroups = [
        {
            groupTitle: 'User & Admin Management',
            items: [
                {
                    label: 'Manage All Users',
                    icon: 'ri-group-line',
                    path: '/admin/users/manage',
                },
                {
                    label: 'Add New Super Admin',
                    icon: 'ri-admin-line',
                    path: '/admin/register',
                },
            ],
        },
        {
            groupTitle: 'Business Operations',
            items: [
                {
                    label: 'Add New Business',
                    icon: 'ri-building-4-line',
                    path: '/admin/business/new',
                },
                {
                    label: 'Manage Businesses',
                    icon: 'ri-store-2-line',
                    path: '/admin/business/manage',
                },
                {
                    label: 'Approve Business Requests',
                    icon: 'ri-checkbox-multiple-line',
                    path: '/admin/business/requests',
                },
                {
                    label: 'Add New Business Admin',
                    icon: 'ri-user-settings-line',
                    path: '/admin/business-admin/new',
                },
            ],
        },
        {
            groupTitle: 'Survey Management',
            items: [
                {
                    label: 'Create New Survey',
                    icon: 'ri-add-circle-line',
                    path: '/create-survey',
                },
                {
                    label: 'View/Manage All Surveys',
                    icon: 'ri-list-check-2',
                    path: '/savedsurveys',
                },
            ],
        },
        {
            groupTitle: 'Business Management & Pricing',
            items: [
                {
                    label: 'Manage Business Tiers',
                    icon: 'ri-stack-line',
                    path: '/admin/business-tiers',
                },
                {
                    label: 'Manage AI Points Packages',
                    icon: 'ri-coins-line',
                    path: '/admin/ai-points-packages',
                },
                {
                    label: 'Manage Quest Packages',
                    icon: 'ri-compass-3-line',
                    path: '/admin/quest-packages',
                },
                {
                    label: 'Manage Admin Seat Packages',
                    icon: 'ri-user-settings-line',
                    path: '/admin/admin-seat-packages',
                },
            ],
        },
        {
            groupTitle: 'Platform Features',
            items: [
                {
                    label: 'Manage Season Pass',
                    icon: 'ri-vip-crown-line',
                    path: '/admin/season-pass',
                },
                {
                    label: 'Manage Marketplace Items',
                    icon: 'ri-store-3-line',
                    path: '/admin/marketplace/manage',
                },
                {
                    label: 'Manage Badges',
                    icon: 'ri-medal-line',
                    path: '/admin/badges',
                },
                {
                    label: 'Manage Quests',
                    icon: 'ri-treasure-map-line',
                    path: '/admin/quests',
                },
                {
                    label: 'Quest Approvals',
                    icon: 'ri-shield-check-line',
                    path: '/admin/quest-approvals',
                },
            ],
        },
        {
            groupTitle: 'Pricing & Monetization',
            items: [
                {
                    label: 'Manage Business Tiers',
                    icon: 'ri-vip-crown-2-line',
                    path: '/admin/business-tiers',
                },
                {
                    label: 'Manage AI Points Packages',
                    icon: 'ri-coin-line',
                    path: '/admin/ai-points-packages',
                },
                {
                    label: 'Pricing Analytics',
                    icon: 'ri-line-chart-line',
                    path: '/admin/pricing-analytics',
                },
            ],
        },
        {
            groupTitle: 'Developer & Testing Tools',
            items: [
                {
                    label: 'AI Test Data Generator',
                    icon: 'ri-robot-line',
                    path: '/ai-test-data',
                },
                {
                    label: 'Survey Test Data Generator',
                    icon: 'ri-database-2-line',
                    path: '/savedsurveys',
                    description: 'Generate random test responses for surveys',
                },
                {
                    label: 'Platform Statistics',
                    icon: 'ri-bar-chart-grouped-line',
                    path: '/admin/platform-overview',
                },
            ],
        },
    ]

    return (
        <div className="test-container"> {/* This remains as a global layout class */}
                  <div >
      <Sidebar />
      </div>
            <div className="sad-dashboard-page"> {/* Renamed */}
                <div className="sad-dashboard-header"> {/* Renamed */}
                    <h1 className="sad-dashboard-title">Super Admin Panel</h1> {/* Renamed */}
                    <p className="sad-dashboard-subtitle"> {/* Renamed */}
                        Oversee and manage all aspects of the Eclipseer platform.
                    </p>
                </div>

                <div className="sad-dashboard-grid"> {/* Renamed */}
                    {actionGroups.map(
                        (group, groupIndex) =>
                            group.items.length > 0 && (
                                <div className="sad-dashboard-card" key={groupIndex}> {/* Renamed */}
                                    <h2 className="sad-card-title">{group.groupTitle}</h2> {/* Renamed */}
                                    <div className="sad-card-actions"> {/* Renamed */}
                                        {group.items.map((action, actionIndex) => (
                                            <button
                                                key={actionIndex}
                                                className="sad-dashboard-button" // Renamed
                                                onClick={() => handleNavigation(action.path)}
                                            >
                                                <i className={action.icon}></i>
                                                <span>{action.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )
                    )}
                </div>
            </div>
        </div>
    )
}

export default SuperAdminDashboard;