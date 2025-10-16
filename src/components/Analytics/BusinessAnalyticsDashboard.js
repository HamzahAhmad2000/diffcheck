import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../common/Sidebar";
import { businessAPI } from "../../services/apiClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { baseURL } from '../../services/apiClient';

import toast from "react-hot-toast";
import "./BusinessAnalyticsDashboard.css";

const BusinessAnalyticsDashboard = () => {
  const { businessId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [businessName, setBusinessName] = useState("");

  const userRole = localStorage.getItem('userRole');
  const dashboardLink = userRole === 'business_admin'
    ? '/business-admin/dashboard'
    : `/admin/business/dashboard/${businessId}`;

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        // Fetch business details
        const businessResponse = await businessAPI.getBusinessDetails(
          businessId
        );
        setBusinessName(businessResponse.data.name);

        // Fetch analytics data using the new summary endpoint
        const analyticsResponse = await businessAPI.getBusinessAnalyticsSummary(
          businessId
        );
        setAnalytics(analyticsResponse.data);
      } catch (error) {
        console.error("Error fetching business analytics:", error);
        setError(
          error.response?.data?.error || "Failed to load analytics data"
        );
        toast.error("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [businessId]);

  if (loading) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="main-content3">
          <div className="loading-container">
            <div className="loading-spinner" />
            <p className="loading-text">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <Sidebar />
        <div className="main-content3">
          <div className="error-container">
            <div className="error-message">
              <i className="ri-error-warning-line"></i>
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="main-content3">
        <div className="analytics-container">
          <div className="analytics-header">
            <Link
              to={dashboardLink}
              className="back-link"
            >
              <i className="ri-arrow-left-line"></i> Back to Business Dashboard
            </Link>
            <h1 className="analytics-title">{businessName} Analytics</h1>
          </div>

          <div className="analytics-grid">
            {/* Summary Cards */}
            <div className="analytics-card">
              <div className="card-content">
                <p className="card-label">Total Surveys</p>
                <h2 className="card-value">{analytics?.totalSurveys || 0}</h2>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-content">
                <p className="card-label">Total Quests</p>
                <h2 className="card-value">{analytics?.totalQuests || 0}</h2>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-content">
                <p className="card-label">Total Points Available</p>
                <h2 className="card-value">
                  {analytics?.totalPointsEarnable || 0} XP
                </h2>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-content">
                <p className="card-label">Survey Respondents</p>
                <h2 className="card-value">
                  {analytics?.completedSurveyRespondents || 0}
                </h2>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-content">
                <p className="card-label">Quest Completions</p>
                <h2 className="card-value">
                  {analytics?.completedQuestUsers || 0}
                </h2>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-content">
                <p className="card-label">Splash Page Visitors</p>
                <h2 className="card-value">
                  {analytics?.splashPageVisitors || 0}
                </h2>
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* AI Policy Footer */}
      <div className="analytics-footer">
        <a href="/legal#ai" target="_blank" rel="noopener noreferrer" className="ai-policy-footer-link">
          AI Use Policy
        </a>
      </div>
    </div>
  );
};

export default BusinessAnalyticsDashboard;
