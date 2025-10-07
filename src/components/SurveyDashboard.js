import React from 'react';
import CreateSurvey from './SurveyManagement/CreateSurvey';
import SavedSurveyList from './SurveyManagement/SavedSurveyList';
//import Header from './Header';

function SurveyDashboard() {
  return (
    <div>
      {/* Remove the h1 heading */}
      <section>
        <CreateSurvey />
      </section>
      {/* not rendering SavedSurveyList directly here */}
     
    </div>
  );
}

export default SurveyDashboard;