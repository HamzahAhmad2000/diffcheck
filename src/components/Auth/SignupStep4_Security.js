import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/apiClient';
import toast from '../../utils/toast';
import '../../styles/Auth.css';
import '../../styles/SecuritySetup.css';

const SignupStep4Security = () => {
  const navigate = useNavigate();
  const [tempAuthToken, setTempAuthToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Security Questions State
  const [availableSecQuestions, setAvailableSecQuestions] = useState([]);
  const [selectedSecQuestions, setSelectedSecQuestions] = useState([
    { questionId: '', answer: '' },
    { questionId: '', answer: '' }
  ]);
  const [secQuestionsLoading, setSecQuestionsLoading] = useState(true);

  // Passkeys State
  const [generatedPasskeys, setGeneratedPasskeys] = useState([]);
  const [passkeysLoading, setPasskeysLoading] = useState(false);
  const [passkeysConfirmedSaved, setPasskeysConfirmedSaved] = useState(false);


  useEffect(() => {
    const token = localStorage.getItem('reg_temp_auth_token');
    if (!token) {
      toast.error("Session expired. Please start registration again.");
      navigate('/register');
    } else {
      setTempAuthToken(token);
    }
  }, [navigate]);

  const fetchSecurityQuestions = useCallback(async () => {
    setSecQuestionsLoading(true);
    try {
      const { data } = await authAPI.getAvailableSecurityQuestions();
      const questions = data?.questions || data;
      setAvailableSecQuestions(Array.isArray(questions) ? questions : []);
    } catch (error) {
      toast.error('Failed to load security questions. Using fallback options.');
      setAvailableSecQuestions([
        { id: 'fb1', question: "What was your first pet's name?" },
        { id: 'fb2', question: 'In what city were you born?' },
        { id: 'fb3', question: "What is your mother's maiden name?" },
      ]);
    }
    setSecQuestionsLoading(false);
  }, []);

  useEffect(() => {
    fetchSecurityQuestions();
  }, [fetchSecurityQuestions]);

  const handleSecQuestionChange = (index, field, value) => {
    const updatedQuestions = [...selectedSecQuestions];
    updatedQuestions[index][field] = value;
    setSelectedSecQuestions(updatedQuestions);
  };

  const handleGeneratePasskeys = async () => {
    setPasskeysLoading(true);
    try {
        const data = await authAPI.generatePasskeys({ tempAuthToken });
        setGeneratedPasskeys(data.passkeys);
        toast.success('Generated new recovery passkeys. Please save them in a secure place.');
    } catch(error) {
        toast.error(error.message || 'Failed to generate passkeys.');
    }
    setPasskeysLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (generatedPasskeys.length > 0 && !passkeysConfirmedSaved) {
        toast.error("Please confirm you have saved your passkeys securely.");
        setIsLoading(false);
        return;
    }

    const savedTagsJson = localStorage.getItem('reg_tags');
    let savedTags = { interests: [], owned_devices: [], memberships: [] };
    if (savedTagsJson) {
      try {
        const parsedData = JSON.parse(savedTagsJson);
        if (typeof parsedData === 'object' && parsedData !== null) {
          savedTags = parsedData;
        }
      } catch (error) {
        console.error("Could not parse registration tags from localStorage:", error);
      }
    }

    const securityData = {
      security_questions: selectedSecQuestions
        .filter(q => q.questionId && q.answer)
        .map(q => ({ question_id: q.questionId, answer: q.answer })),
      passkeys: passkeysConfirmedSaved ? generatedPasskeys : [], // Only send if confirmed saved
      tempAuthToken,
      ...savedTags // Add saved tags to the final payload
    };

    try {
      const response = await authAPI.completeRegistrationStep4Security(securityData);
      toast.success('Registration complete! Welcome!');
      
      // Set authentication data from response
      if (response.data.token && response.data.user) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('userRole', response.data.role || 'user');
      }
      
      // Cleanup registration localStorage
      localStorage.removeItem('reg_temp_auth_token');
      localStorage.removeItem('reg_user_email');
      localStorage.removeItem('reg_tags');
      
      // Navigate based on user role
      const userRole = response.data.role || 'user';
      if (userRole === 'super_admin' || userRole === 'admin') {
        navigate('/admin');
      } else if (userRole === 'business_admin') {
        navigate('/business-admin/dashboard');
      } else {
        navigate('/user/home');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'An error occurred during final registration.');
    }
    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2 className="auth-title">Step 4: Setup Security Options</h2>
        <p className="auth-subtitle">Enhance your account security. These are optional but recommended.</p>

        {/* Security Questions Section */}
        <div className="security-section">
          <h4>Security Questions (Choose 2)</h4>
          {selectedSecQuestions.map((item, index) => (
            <div key={index} className="security-question-item">
              <select
                value={item.questionId}
                onChange={(e) => handleSecQuestionChange(index, 'questionId', e.target.value)}
                className="auth-input"
                disabled={secQuestionsLoading || isLoading}
              >
                <option value="">Select Question {index + 1}</option>
                {availableSecQuestions.map(q => (
                  <option key={q.id} value={q.id}>{q.question}</option>
                ))}
              </select>
              <input 
                type="text" 
                value={item.answer}
                onChange={(e) => handleSecQuestionChange(index, 'answer', e.target.value)}
                placeholder={`Answer for Question ${index + 1}`}
                className="auth-input"
                disabled={isLoading}
                required={item.questionId !== ''} // Make answer required if a question is selected
              />
            </div>
          ))}
        </div>

        {/* Passkeys Section */}
        <div className="security-section" style={{color: '#000'}}>
            <h4>Recovery Passkeys</h4>
            <p>Generate one-time use passkeys to recover your account if you lose password access.</p>
            <button type="button" onClick={handleGeneratePasskeys} className="auth-button secondary" style={{backgroundColor: '#007bff', color: '#fff'}} disabled={passkeysLoading || isLoading || generatedPasskeys.length > 0}>
                {passkeysLoading ? 'Generating...' : 'Generate Passkeys'}
            </button>
            {generatedPasskeys.length > 0 && (
                <div className="passkeys-display">
                    <p><strong>Please save these passkeys somewhere safe. You will not be shown them again.</strong></p>
                    <ul>
                        {generatedPasskeys.map((key, index) => <li key={index}>{key}</li>)}
                    </ul>
                    <label>
                        <input type="checkbox" checked={passkeysConfirmedSaved} onChange={(e) => setPasskeysConfirmedSaved(e.target.checked)} />
                        I have securely saved these passkeys.
                    </label>
                </div>
            )}
        </div>
        
        <div className="form-actions">
          <button type="submit" className="auth-button primary" style={{backgroundColor: '#007bff', color: '#fff'}} disabled={isLoading || secQuestionsLoading || passkeysLoading}>
            {isLoading ? 'Completing Registration...' : 'Complete Registration & Login'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SignupStep4Security; 