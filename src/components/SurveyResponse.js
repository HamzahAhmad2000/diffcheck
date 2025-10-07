import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import toast from "../utils/toast";
import { Toaster } from "react-hot-toast";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/fonts.css";
import "../styles/slider.css";
import "../styles/SurveyResponse.css";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { surveyAPI, uploadAPI, baseURL, authAPI } from "../services/apiClient";

const fontStyles = `
@font-face {
  font-family: 'ClashDisplay';
  src: url('/src/fonts/ClashDisplay-Bold.otf') format('opentype');
  font-weight: bold;
  font-style: normal;
}
@font-face {
  font-family: 'ClashDisplay';
  src: url('/src/fonts/ClashDisplay-Regular.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}

/* Reset CSS */
body {
  margin: 0;
  padding: 0;
  background: #000;
  overflow-x: hidden;
  width: 100vw;
  min-height: 100vh;
}
`;

// ---------------------------
// 10. Styles
// ---------------------------
const styles = {
  container: {
    width: "100vw",
    minHeight: "100vh",
    padding: "20px",
    margin: 0,
    boxSizing: "border-box",
    fontFamily: "Poppins, sans-serif",
    background: "000",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflowX: "hidden",
    cursor: "default",
  },
  loadingContainer: {
    textAlign: "center",
    padding: "40px",
    fontSize: "1.2em",
    color: "#fff",
  },
  headerWrapper: {
    marginTop: "70px",
    width: "100%",
    height: "80px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  header: {
    width: "1204px",
    height: "80px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 20px",
    boxSizing: "border-box",
  },
  progressCounter: {
    fontFamily: "ClashDisplay, sans-serif",
    fontSize: "80px",
    fontWeight: "bold",
    color: "#fff",
    lineHeight: "80px",
    marginLeft: "auto",
    textAlign: "right",
  },
  dividerWrapper: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  coloredDivider: {
    width: "1160px",
    height: "1px",
    backgroundColor: "#AA2EFF",
    margin: 0,
  },
  noteWrapper: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    margin: 0,
    padding: 0,
  },
  progressNote: {
    width: "1160px",
    textAlign: "right",
    color: "#4A4A4A",
    fontFamily: "Poppins, sans-serif",
    fontSize: "15px",
    fontWeight: 300,
    lineHeight: "20px",
    boxSizing: "border-box",
    margin: 0,
  },
  leaveButton: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "8px 16px",
    backgroundColor: "transparent",
    color: "#fff",
    border: "1px solid #aa2eff",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "Poppins, sans-serif",
    fontSize: "14px",
    height: "fit-content",
  },
  questionSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 0",
  },
  contentWrapper: {
    width: "565px",
    margin: "0 auto",
    position: "relative",
  },
  answerContainer: {
    width: "auto",
    minWidth: "565px",
    position: "relative",
    marginBottom: "20px",
  },
  questionTextContainer: {
    width: "565px",
    marginBottom: "16px",
  },
  inputContainer: {
    width: "auto",
    minWidth: "565px",
  },
  questionText: {
    margin: 0,
    color: "#fff",
    marginRight: "10px",
    fontFamily: "Poppins",
    fontSize: "20px",
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: "normal",
  },
  infoButton: {
    position: "absolute",
    top: "-30px",
    right: "-30px",
    background: "none",
    border: "none",
    padding: "0",
    cursor: "pointer",
    color: "#AA2EFF",
  },
  additionalInfo: {
    width: "565px",
    marginTop: "10px",
    marginBottom: "20px",
    padding: "15px",
    backgroundColor: "rgba(170, 46, 255, 0.1)",
    border: "1px solid rgba(170, 46, 255, 0.3)",
    borderRadius: "8px",
    fontSize: "16px",
    color: "#fff",
    fontFamily: "Poppins, sans-serif",
    boxSizing: "border-box",
  },
  textArea: {
    width: "565px",
    height: "162px",
    border: "1px solid #EAEAEA",
    borderRadius: "10px",
    backgroundColor: "transparent",
    color: "#fff",
    padding: "15px",
    fontSize: "16px",
    resize: "none",
    "&::placeholder": {
      color: "#4F4F4F",
      fontFamily: "Poppins",
      fontSize: "15px",
      fontStyle: "normal",
      fontWeight: "400",
      lineHeight: "normal",
    },
  },
  inputField: {
    color: "#fff",
    fontFamily: "Poppins",
    fontSize: "15px",
    fontStyle: "normal",
    fontWeight: "400",
    lineHeight: "normal",
    "&::placeholder": {
      color: "#4F4F4F",
      fontFamily: "Poppins",
      fontSize: "15px",
      fontStyle: "normal",
      fontWeight: "400",
      lineHeight: "normal",
    },
  },
  sliderContainer: {
    margin: "20px 0",
  },
  slider: {
    width: "100%",
    height: "4px",
    appearance: "none",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    outline: "none",
    borderRadius: "2px",
    transition: "0.2s",
  },
  sliderValue: {
    marginTop: "10px",
    fontSize: "16px",
    color: "rgba(255, 255, 255, 0.7)",
    fontFamily: "Poppins, sans-serif",
  },
  optionContainer: {
    margin: "12px 0",
  },
  optionLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "50px",
    cursor: "pointer",
  },
  optionText: {
    color: "#FFF",
    fontFamily: "Clash Display",
    fontSize: "15px",
    fontStyle: "normal",
    fontWeight: 500,
    lineHeight: "normal",
    marginLeft: "20px",
  },
  radioIconUnchecked: {
    width: "26px",
    height: "26px",
    flexShrink: 0,
    borderRadius: "50px",
    border: "1px solid #4F4F4F",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  radioIconChecked: {
    width: "26px",
    height: "26px",
    flexShrink: 0,
    borderRadius: "50px",
    border: "1px solid #aa2eff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#aa2eff",
  },
  checkboxUnchecked: {
    width: "26px",
    height: "26px",
    flexShrink: 0,
    borderRadius: "10px",
    border: "1px solid #4F4F4F",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxChecked: {
    width: "26px",
    height: "26px",
    flexShrink: 0,
    borderRadius: "10px",
    border: "1px solid #aa2eff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#aa2eff",
  },
  sectionDivider: {
    width: "565px",
    height: "1px",
    backgroundColor: "#AA2EFF",
    margin: "20px 0",
  },
  navigation: {
    width: "565px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "relative",
    boxSizing: "border-box",
  },
  prevButton: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "10px 0",
    backgroundColor: "transparent",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontFamily: "Poppins, sans-serif",
    fontSize: "16px",
  },
  nextButton: {
    display: "flex",
    alignItems: "center",
    position: "absolute",
    right: "0px",
    gap: "5px",
    padding: "10px 0",
    backgroundColor: "transparent",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontFamily: "Poppins, sans-serif",
    fontSize: "16px",
  },
  icon: {
    fontSize: "20px",
    display: "inline-flex",
    alignItems: "center",
    verticalAlign: "middle",
  },
  questionImage: {
    width: "565px",
    height: "300px",
    marginBottom: "24px",
    borderRadius: "10px",
    overflow: "hidden",
  },
  questionImageContent: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  descriptionContainer: {
    width: "565px",
    marginBottom: "24px",
  },

  descriptionText: {
    margin: 0,
    color: "#EAEAEA",
    fontFamily: "Poppins",
    fontSize: "18px",
    fontStyle: "normal",
    fontWeight: "400",
    lineHeight: "normal",
  },

  hiddenRadioInput: {
    display: "none",
  },

  optionContainer: {
    margin: "12px 0",
  },

  optionLabel: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "16px",
    color: "#fff",
    fontFamily: "Poppins, sans-serif",
    cursor: "pointer",
  },

  radioIconUnchecked: {
    fontSize: "20px",
    color: "#fff",
    marginRight: "8px",
  },

  radioIconChecked: {
    fontSize: "20px",
    color: "#AA2EFF",
    marginRight: "8px",
  },
  singleChoiceContainer: {
    margin: "12px 0",
  },
  singleChoiceLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "20px",
    cursor: "pointer",
  },
  singleChoiceText: {
    color: "#FFF",
    fontFamily: "Clash Display",
    fontSize: "15px",
    fontStyle: "normal",
    fontWeight: 500,
    lineHeight: "normal",
  },
  singleChoiceUnchecked: {
    width: "26px",
    height: "26px",
    flexShrink: 0,
    borderRadius: "50px",
    border: "1px solid #4F4F4F",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  singleChoiceChecked: {
    width: "26px",
    height: "26px",
    flexShrink: 0,
    borderRadius: "50px",
    border: "1px solid #aa2eff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#aa2eff",
  },

  sliderWrapper: {
    width: "565px",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  sliderTitle: {
    fontSize: "16px",
    color: "#BDBDBD",
    fontFamily: "Poppins, sans-serif",
  },

  sliderContainer: {
    width: "100%",
    position: "relative",
  },

  slider: {
    width: "100%",
    WebkitAppearance: "none",
    background: "transparent",
    outline: "none",
    "&::-webkit-slider-runnable-track": {
      height: "2px",
      backgroundColor: "#4F4F4F",
    },
    "&::-moz-range-track": {
      height: "2px",
      backgroundColor: "#4F4F4F",
    },
    "&::-webkit-slider-thumb": {
      WebkitAppearance: "none",
      height: "14px",
      width: "14px",
      borderRadius: "50%",
      background: "#AA2EFF",
      cursor: "pointer",
      marginTop: "-6px",
    },
    "&::-moz-range-thumb": {
      height: "14px",
      width: "14px",
      borderRadius: "50%",
      background: "#AA2EFF",
      cursor: "pointer",
      border: "none",
    },
  },

  sliderMinMax: {
    display: "flex",
    justifyContent: "space-between",
    color: "#FFFFFF",
    fontSize: "14px",
    fontFamily: "Poppins, sans-serif",
  },

  selectedValueLabel: {
    fontSize: "16px",
    color: "#FFFFFF",
    fontFamily: "Poppins, sans-serif",
  },

  customTrack: {
    position: "relative",
    width: "100%",
    height: "2px",
    backgroundColor: "#4F4F4F",
  },

  customThumb: {
    position: "absolute",
    top: "-6px",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    backgroundColor: "#AA2EFF",
    transform: "translateX(-50%)",
  },
  readOnlyTrackWrapper: {
    width: "565px",
    marginTop: "40px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  gridContainer: {
    marginTop: "10px",
    overflowX: "auto",
  },
  gridTable: {
    width: "100%",
    borderCollapse: "collapse",
    border: "1px solid #ddd",
  },
  gridHeaderCell: {
    padding: "8px",
    backgroundColor: "#f8f8f8",
    border: "1px solid #ddd",
    fontWeight: "bold",
    textAlign: "center",
  },
  gridLabelCell: {
    padding: "8px",
    border: "1px solid #ddd",
    backgroundColor: "#f8f8f8",
    fontWeight: "500",
  },
  gridCell: {
    padding: "8px",
    border: "1px solid #ddd",
    textAlign: "center",
  },
  gridStarCell: {
    padding: "8px",
    border: "1px solid #ddd",
  },
  starRatingContainer: {
    display: "flex",
    justifyContent: "center",
  },
  star: {
    fontSize: "24px",
    cursor: "pointer",
    margin: "0 2px",
  },
};

const SurveyResponse = () => {
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [branchFlow, setBranchFlow] = useState(null);
  const [showAdditional, setShowAdditional] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [numberError, setNumberError] = useState("");
  const [error, setError] = useState("");
  const [lastExitedBranch, setLastExitedBranch] = useState(null);
  const [surveyLinkId, setSurveyLinkId] = useState(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [surveyStartTime, setSurveyStartTime] = useState(null);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [responseTimesData, setResponseTimesData] = useState({});
  const [userAgentInfo, setUserAgentInfo] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatureType, setSignatureType] = useState("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [selectedFont, setSelectedFont] = useState(null);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualificationMessage, setDisqualificationMessage] = useState("");
  // Add new state for document upload
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  // Add state for interactive ranking items at the top level
  const [rankingItems, setRankingItems] = useState([]);
  const [jumpStack, setJumpStack] = useState([]); // For handling nested branches/jumps
  const [hasEnteredBranch, setHasEnteredBranch] = useState(false); // Tracks if currently in a branch

  const signatureFonts = [
    { name: "Dancing Script", class: "Dancing Script" },
    { name: "Great Vibes", class: "Great Vibes" },
    { name: "Pacifico", class: "Pacifico" },
    { name: "Satisfy", class: "Satisfy" },
    { name: "Sacramento", class: "Sacramento" },
    { name: "Allura", class: "Allura" },
  ];

  const signatureRef = useRef(null);
  const signaturePadRef = useRef(null);

  const { surveyId, linkCode } = useParams();

  const getCurrentQuestion = useCallback(() => {
    if (!survey) return null;

    const mainFlow = survey.questions;
    const currentFlow = branchFlow ? branchFlow.questions : mainFlow;
    const activeIndex = branchFlow
      ? branchFlow.currentIndex
      : currentQuestionIndex;

    return currentFlow[activeIndex]
      ? {
          ...currentFlow[activeIndex],
          question_type:
            currentFlow[activeIndex]?.type ||
            currentFlow[activeIndex]?.question_type ||
            "text",
          question_text:
            currentFlow[activeIndex]?.text ||
            currentFlow[activeIndex]?.question_text ||
            "",
          sequence_number:
            currentFlow[activeIndex]?.sequence_number || activeIndex + 1,
          options: currentFlow[activeIndex]?.options || [],
        }
      : null;
  }, [survey, branchFlow, currentQuestionIndex]);

  const currentQuestion = getCurrentQuestion();

  // Effect to initialize/update rankingItems when the question type is interactive-ranking
  useEffect(() => {
    if (currentQuestion?.question_type === "interactive-ranking") {
      const currentResponse = responses[currentQuestion.sequence_number];
      const initialItems =
        currentQuestion.ranking_items?.map((item, index) => ({
          id: `item-${index}`, // Use a more stable ID if possible, but index is fallback
          text: typeof item === "object" ? item.text : item,
          // Initialize rank based on existing response or default order
          rank:
            currentResponse?.[
              typeof item === "object" ? item.text : item
            ] || index + 1,
        })) || [];
      // Sort items based on initial rank for display
      initialItems.sort((a, b) => a.rank - b.rank);
      setRankingItems(initialItems);
    } else {
      // Optionally clear when not ranking question
      setRankingItems([]);
    }
  }, [currentQuestion?.sequence_number, currentQuestion?.question_type, currentQuestion?.ranking_items]);

  const validateEmail = (email, allowedDomains) => {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;

    if (allowedDomains) {
      const domain = email.split("@")[1];
      const domains = allowedDomains.split(",").map((d) => d.trim());
      if (!domains.includes(domain)) return false;
    }
    return true;
  };

  const validateNumber = (value, min, max) => {
    if (value === "" || value === null || value === undefined) return true;
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    if (min != null && num < min) return false;
    if (max != null && num > max) return false;
    return true;
  };

  const checkDisqualification = (question, answer) => {
    if (!question.disqualify_enabled) return false;

    const rules = question.disqualify_rules || [];
    for (const rule of rules) {
      if (rule.type === "option" && rule.condition === "selected") {
        if (Array.isArray(answer)) {
          if (answer.includes(rule.option)) {
            return true;
          }
        } else if (answer === rule.option) {
          return true;
        }
      } else if (rule.type === "value") {
        const numericAnswer = parseFloat(answer);
        const ruleValue = parseFloat(rule.value);

        if (!isNaN(numericAnswer) && !isNaN(ruleValue)) {
          switch (rule.condition) {
            case "less":
              return numericAnswer < ruleValue;
            case "greater":
              return numericAnswer > ruleValue;
            case "equal":
              return numericAnswer === ruleValue;
            default:
              return false;
          }
        }
      } else if (rule.type === "date") {
        const answerDate = new Date(answer);
        const ruleDate = new Date(rule.value);

        if (answerDate && ruleDate) {
          answerDate.setHours(0, 0, 0, 0);
          ruleDate.setHours(0, 0, 0, 0);

          switch (rule.condition) {
            case "before":
              return answerDate < ruleDate;
            case "after":
              return answerDate > ruleDate;
            case "on":
              return answerDate.getTime() === ruleDate.getTime();
            default:
              return false;
          }
        }
      }
    }
    return false;
  };

  const handleEmailChange = useCallback(
    (e, allowedDomains) => {
      if (!currentQuestion) return;
      const email = e.target.value;
      setResponses((prev) => ({
        ...prev,
        [currentQuestion.sequence_number]: email,
      }));

      if (!validateEmail(email, allowedDomains)) {
        setEmailError(
          allowedDomains
            ? `Email must be from: ${allowedDomains}`
            : "Please enter a valid email address"
        );
      } else {
        setEmailError("");
      }
    },
    [currentQuestion]
  );

  useEffect(() => {
    const now = new Date();
    setSurveyStartTime(now);
    setQuestionStartTime(now);

    try {
      const userAgent = window.navigator.userAgent;
      const isMobile = /Mobi|Android/i.test(userAgent);
      const isTablet = /Tablet|iPad/i.test(userAgent);
      const deviceType = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";

      let browserInfo = "Other";
      if (userAgent.indexOf("Chrome") > -1) browserInfo = "Chrome";
      else if (userAgent.indexOf("Firefox") > -1) browserInfo = "Firefox";
      else if (userAgent.indexOf("Safari") > -1) browserInfo = "Safari";
      else if (
        userAgent.indexOf("MSIE") > -1 ||
        userAgent.indexOf("Trident") > -1
      )
        browserInfo = "IE";
      else if (userAgent.indexOf("Edge") > -1) browserInfo = "Edge";

      setUserAgentInfo({
        userAgent,
        deviceType,
        browserInfo,
      });
    } catch (err) {
      console.error("Error capturing device info:", err);
    }

    window.surveyStartTime = now;
    return () => {
      window.surveyStartTime = null;
    };
  }, []);

  useEffect(() => {
    const userToken = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (userToken && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setLoggedInUser(parsedUser);
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
    }
  }, []);

  useEffect(() => {
    const fetchSurvey = async () => {
      if (!surveyId) return; // Ensure surveyId is present
      try {
        // Use public endpoint for panelists taking surveys
        const res = await surveyAPI.getPublicSurveyById(surveyId);

        const data = res.data;
        setSurvey(data);
        if (data.completed_by_user) {
          setAlreadyCompleted(true);
        }
      } catch (err) {
        console.error("Exception fetching survey in SurveyResponse.js:", err);
        if (err.response) {
          console.error("Response error data:", err.response.data);
          console.error("Response error status:", err.response.status);
          let userMessage = `Error loading survey: ${err.response.data.message || err.response.data.error || err.response.statusText}`;
          if (err.response.status === 403) {
            userMessage = "Access Denied: You do not meet the criteria for this survey.";
          } else if (err.response.status === 404) {
            userMessage = "Survey not found or is not currently published for responses.";
          }
          setError(userMessage);
          toast.error(userMessage);
        } else if (err.request) {
          console.error("No response received:", err.request);
          setError("Network error: Could not reach server.");
          toast.error("Network error loading survey.");
        } else {
          console.error("Error setting up request:", err.message);
          setError(`Error: ${err.message}`);
          toast.error(`Error loading survey: ${err.message}`);
        }
        setSurvey(null); // Ensure survey is null on error
      }
    };
    fetchSurvey();
  }, [surveyId]);

  useEffect(() => {
    const css = `
      input::placeholder, textarea::placeholder {
        color: #4F4F4F !important;
        font-family: Poppins !important;
        font-size: 15px !important;
        font-style: normal !important;
        font-weight: 400 !important;
        line-height: normal !important;
      }
    `;
    const style = document.createElement("style");
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Corrected useEffect for fetching links
  useEffect(() => {
    const fetchLinkByCode = async () => {
      // Ensure surveyId and linkCode are available
      if (!linkCode || !surveyId) return;
      try {
        console.log(`Fetching links for survey ${surveyId}...`); // Debugging log
        // Use the correct API method: getLinks(surveyId)
        const res = await surveyAPI.getLinks(surveyId);

        // Axios response data is in res.data
        const links = res.data;
        console.log("Received links:", links); // Debugging log

        // Filter the links array client-side to find the matching code
        if (Array.isArray(links)) {
          const matchedLink = links.find((link) => link.code === linkCode);
          if (matchedLink) {
            console.log("Matched link found:", matchedLink); // Debugging log
            setSurveyLinkId(matchedLink.id);
          } else {
            console.warn("No distribution link found matching code:", linkCode);
            // Optionally set an error state or show a message to the user
          }
        } else {
          console.error("Received invalid data format for links:", links);
          // Handle unexpected data format (e.g., show an error)
        }
      } catch (err) {
        // Error handling (already logged by interceptor, maybe show user message)
        console.error("Error fetching distribution links:", err);
        toast.error("Could not load link information.");
      }
    };
    fetchLinkByCode();
  }, [linkCode, surveyId]); // Dependencies are correct

    // Track if canvas has been initialized to prevent re-initialization
  const [canvasInitialized, setCanvasInitialized] = useState(false);

  // Signature canvas initialization - using useCallback to prevent infinite loops
  const initializeSignatureCanvas = useCallback(() => {
    if (
      !signatureRef.current ||
      !currentQuestion ||
      currentQuestion.question_type !== "signature" ||
      signatureType !== "draw" ||
      canvasInitialized
    ) {
      return;
    }

    const canvas = signatureRef.current;
    const ctx = canvas.getContext("2d");
    
    // Set explicit canvas size
    canvas.width = 565;
    canvas.height = 200;
    
    // Set drawing style
    ctx.strokeStyle = currentQuestion.signature_options?.penColor || "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Clear canvas and set background
    ctx.fillStyle = currentQuestion.signature_options?.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setCanvasInitialized(true);
    console.log('Canvas initialized:', { width: canvas.width, height: canvas.height });
  }, [currentQuestion?.sequence_number, signatureType, canvasInitialized]);

  useEffect(() => {
    // Reset canvas initialization flag when question changes
    if (currentQuestion?.question_type === "signature") {
      setCanvasInitialized(false);
    }
  }, [currentQuestion?.sequence_number]);

  useEffect(() => {
    // Only initialize once when conditions are met
    initializeSignatureCanvas();
  }, [initializeSignatureCanvas]);

  useEffect(() => {
    if (
      !signatureRef.current ||
      !currentQuestion ||
      currentQuestion.question_type !== "signature" ||
      signatureType !== "draw"
    ) {
      return;
    }
    
    const canvas = signatureRef.current;
    const ctx = canvas.getContext("2d");
    let isDrawing = false;

    const getCoordinates = (event) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      let clientX, clientY;
      
      // Handle both mouse and touch events
      if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }
      
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      
      return { x, y };
    };

    const startDrawing = (e) => {
      e.preventDefault();
      isDrawing = true;
      const { x, y } = getCoordinates(e);
      
      console.log('Drawing started at:', { x, y });
      
      // Start a new path
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      
      const { x, y } = getCoordinates(e);
      
      console.log('Drawing to:', { x, y });
      
      // Draw line to current position
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      isDrawing = false;
      
      console.log('Drawing stopped');
      
      // Save signature data only when drawing stops
      setTimeout(() => {
        const dataUrl = canvas.toDataURL('image/png');
        setResponses((prev) => ({
          ...prev,
          [currentQuestion.sequence_number]: {
            type: "draw",
            signature: dataUrl,
            name: typedSignature
          },
        }));
      }, 100); // Small delay to ensure drawing is complete
    };

    // Add event listeners
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);
    
    canvas.addEventListener("touchstart", startDrawing);
    canvas.addEventListener("touchmove", draw);
    canvas.addEventListener("touchend", stopDrawing);

    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mouseleave", stopDrawing);
      
      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDrawing);
    };
  }, [currentQuestion?.sequence_number, signatureType]); // Stable dependencies

  useEffect(() => {
    if (questionStartTime && currentQuestionIndex > 0 && !branchFlow) {
      const now = new Date();
      const timeSpent = Math.floor((now - questionStartTime) / 1000);
      const prevQuestion = survey?.questions[currentQuestionIndex - 1];
      if (prevQuestion) {
        setResponseTimesData((prev) => ({
          ...prev,
          [prevQuestion.sequence_number]: timeSpent,
        }));
      }
    }
    setQuestionStartTime(new Date());
  }, [currentQuestionIndex, branchFlow, survey]);

  // Add a useEffect to check conditional logic when the current question changes
  useEffect(() => {
    if (survey && !showThankYou && !isDisqualified) {
      const currentQ = branchFlow
        ? branchFlow.questions[branchFlow.currentIndex]
        : survey.questions[currentQuestionIndex];

      // Log current question's details
      console.log("[Current Question Updated]", {
        sequenceNumber: currentQ?.sequence_number,
        text: currentQ?.question_text || currentQ?.text,
        hasConditionalLogic: !!currentQ?.conditional_logic_rules
      });

      // Log current question's conditional logic if it exists
      if (currentQ && currentQ.conditional_logic_rules) {
        console.log("[Current Question] Has conditional logic:", currentQ.conditional_logic_rules);
        console.log("[Current Question] Current responses:", responses);
        
        // Check if this question should actually be skipped
        const shouldBeSkipped = shouldSkipQuestion(currentQ.conditional_logic_rules, responses);
        console.log("[Current Question] Should be skipped according to its own logic?", shouldBeSkipped);
      }
    }
  }, [currentQuestionIndex, branchFlow, showThankYou, isDisqualified, responses, survey]);

  // Clean up responses for questions that should be hidden based on current answers
  useEffect(() => {
    if (!survey) return;
    const updated = { ...responses };
    let changed = false;

    survey.questions.forEach((q) => {
      if (
        q.conditional_logic_rules &&
        shouldSkipQuestion(q.conditional_logic_rules, responses) &&
        Object.prototype.hasOwnProperty.call(updated, q.sequence_number)
      ) {
        delete updated[q.sequence_number];
        changed = true;
      }
    });

    if (changed) {
      setResponses(updated);
    }
  }, [responses, survey]);

  // Helper function to update responses with dual UUID/sequence storage
  const updateQuestionResponse = (question, value) => {
    setResponses((prev) => {
      const newResponses = { ...prev };
      
      // Store response with both UUID (if available) and sequence number for compatibility
      if (question.question_uuid) {
        newResponses[question.question_uuid] = value;
      }
      newResponses[question.sequence_number] = value;
      
      return newResponses;
    });
  };

  // Helper function to determine if a question should be skipped based on conditional logic
  const shouldSkipQuestion = (questionLogic, currentResponses) => {
    if (!questionLogic) {
      return false; // No logic, don't skip
    }

    // Check for UUID-based logic first (preferred)
    let baseQuestion = null;
    let baseQuestionResponse = null;

    if (questionLogic.baseQuestionUuid) {
      // UUID-based logic (new system)
      baseQuestion = survey?.questions?.find(q => q.question_uuid === questionLogic.baseQuestionUuid);
      if (!baseQuestion) {
        console.warn(`[shouldSkipQuestion] Base question UUID ${questionLogic.baseQuestionUuid} not found. Not skipping.`);
        return false;
      }
      // Check response using UUID
      baseQuestionResponse = currentResponses[questionLogic.baseQuestionUuid] || currentResponses[baseQuestion.sequence_number];
    } else if (questionLogic.baseQuestionSequence) {
      // Fallback to sequence-based logic (backward compatibility)
      const baseSeq = parseInt(questionLogic.baseQuestionSequence, 10);
      baseQuestion = survey?.questions?.find(q => q.sequence_number === baseSeq);
      if (!baseQuestion) {
        console.warn(`[shouldSkipQuestion] Base question Q${questionLogic.baseQuestionSequence} not found. Not skipping.`);
        return false;
      }
      baseQuestionResponse = currentResponses[questionLogic.baseQuestionSequence];
    } else {
      return false; // No valid reference
    }

    const { conditionType, conditionValue } = questionLogic;

    // If the base question for the condition hasn't been answered yet,
    // the dependent question should generally NOT be shown (i.e., it should be skipped).
    if (baseQuestionResponse === undefined || baseQuestionResponse === null || (Array.isArray(baseQuestionResponse) && baseQuestionResponse.length === 0)) {
      // console.log(`[shouldSkipQuestion] Base Q${baseQuestionSequence} not answered. Skipping dependent question.`);
      return true; // Condition not met because base is unanswered, so skip dependent
    }

    // console.log(`[shouldSkipQuestion] Evaluating Q${currentQuestion?.sequence_number} based on Q${baseQuestionSequence}`);
    // console.log(`  Base Q type: ${baseQuestion.type || baseQuestion.question_type}`);
    // console.log(`  Base Q response:`, baseQuestionResponse);
    // console.log(`  Condition type: ${conditionType}`);
    // console.log(`  Condition value:`, conditionValue);

    switch (baseQuestion.type || baseQuestion.question_type) { // Use baseQuestion's type for evaluation
      case "single-choice":
        // conditionValue here is expected to be the string of the option text
        const shouldShowSingle = baseQuestionResponse === conditionValue;
        // console.log(`  single-choice: base response "${baseQuestionResponse}" === condition "${conditionValue}" ? ${shouldShowSingle}`);
        return !shouldShowSingle; // Skip if NOT equal

      case "multi-choice":
        if (!Array.isArray(baseQuestionResponse) || !conditionValue || !Array.isArray(conditionValue.options)) {
          // console.log("  multi-choice: Invalid response or condition. Not skipping.");
          return false; // Invalid data, don't skip
        }
        const { options: requiredOptions, matchType } = conditionValue;
        let meetsMultiChoiceCondition;
        if (matchType === 'all') {
          meetsMultiChoiceCondition = requiredOptions.every(opt => baseQuestionResponse.includes(opt));
        } else { // 'any'
          meetsMultiChoiceCondition = requiredOptions.some(opt => baseQuestionResponse.includes(opt));
        }
        // console.log(`  multi-choice: response [${baseQuestionResponse.join(',')}] ${matchType} of [${requiredOptions.join(',')}] ? ${meetsMultiChoiceCondition}`);
        return !meetsMultiChoiceCondition; // Skip if condition NOT met

      case 'nps':
      case 'rating': // slider
      case 'star-rating':
      case 'numerical-input':
        if (!conditionValue || typeof conditionValue.operator === 'undefined' || conditionValue.value === undefined || conditionValue.value === null) {
          // console.log("  numerical: Invalid conditionValue object. Not skipping.");
          return false; // Invalid condition, don't skip
        }
        const actualNum = parseFloat(baseQuestionResponse);
        const targetNum = parseFloat(conditionValue.value);

        if (isNaN(actualNum) || isNaN(targetNum)) {
          // console.log("  numerical: Non-numeric response or target. Not skipping.");
          return false; // Cannot compare, don't skip
        }

        let meetsNumericalCondition = false;
        switch (conditionValue.operator) {
          case 'eq': 
          case 'equal': 
            meetsNumericalCondition = actualNum === targetNum; 
            break;
          case 'neq': 
          case 'not_equal': 
            meetsNumericalCondition = actualNum !== targetNum; 
            break;
          case 'gt': 
          case 'greater': 
            meetsNumericalCondition = actualNum > targetNum; 
            break;
          case 'gte': 
          case 'greater_equal': 
            meetsNumericalCondition = actualNum >= targetNum; 
            break;
          case 'lt': 
          case 'less': 
            meetsNumericalCondition = actualNum < targetNum; 
            break;
          case 'lte': 
          case 'less_equal': 
            meetsNumericalCondition = actualNum <= targetNum; 
            break;
          default:
            console.warn(`  numerical: Unknown operator "${conditionValue.operator}". Not skipping.`);
            return false; // Unknown operator, don't skip
        }
        // console.log(`  numerical: ${actualNum} ${conditionValue.operator} ${targetNum} ? ${meetsNumericalCondition}`);
        return !meetsNumericalCondition; // Skip if condition NOT met

      default:
        // console.warn(`[shouldSkipQuestion] Unsupported base question type for logic: ${baseQuestion.type || baseQuestion.question_type}. Not skipping.`);
        return false; // Unsupported base type, don't skip
    }
  };

  if (!survey) {
    return (
      <div style={styles.loadingContainer}>
        {error ? (
          <div>
            <p style={{ color: '#ff6b6b', marginBottom: '10px' }}>Error loading survey</p>
            <p style={{ fontSize: '0.9em', color: '#ccc' }}>{error}</p>
          </div>
        ) : (
          <p>Loading survey...</p>
        )}
      </div>
    );
  }

  const handleAnswerChange = (e) => {
    const { value } = e.target;
    
    // Allow deselection by clicking the same radio button again
    if (currentQuestion.question_type === 'single-choice' || currentQuestion.question_type === 'scale') {
      const currentResponse = responses[currentQuestion.sequence_number];
      if (currentResponse === value) {
        // Deselect - clear the response
        updateQuestionResponse(currentQuestion, null);
        return;
      }
    }
    
    // N/A handling - when selecting a regular option, clear N/A
    if (value && value !== "N/A" && value !== "_na_") {
      updateQuestionResponse(currentQuestion, value);
    } else if (value === "N/A" || value === "_na_") {
      // When selecting N/A, clear other selections
      updateQuestionResponse(currentQuestion, "N/A");
    } else {
      // Regular value selection
      updateQuestionResponse(currentQuestion, value);
    }
  };
  
  const handleCheckboxChange = (option) => (e) => {
    let currentVals = responses[currentQuestion.sequence_number] || [];
    if (!Array.isArray(currentVals)) currentVals = [];

    // Handle N/A selection - it should clear all other selections
    if (option === "N/A" || option === "_na_") {
      if (e.target.checked) {
        // When selecting N/A, clear all other selections and only keep N/A
        updateQuestionResponse(currentQuestion, [option]);
      } else {
        // When deselecting N/A, just clear the N/A
        updateQuestionResponse(currentQuestion, []);
      }
      return;
    }

    // Handle regular option selection - if N/A is selected, deselect it
    if (e.target.checked) {
      // Remove N/A if present
      currentVals = currentVals.filter(val => val !== "N/A" && val !== "_na_");
      
      // Check if adding would exceed max_selection
      if (
        currentQuestion.max_selection &&
        currentVals.length >= currentQuestion.max_selection
      ) {
        toast.error(
          `You can select maximum ${currentQuestion.max_selection} options`
        );
        return;
      }
      currentVals = [...currentVals, option];
    } else {
      currentVals = currentVals.filter((val) => val !== option);
    }

    updateQuestionResponse(currentQuestion, currentVals);
  };

  const handleSelectAllCheckbox = (e) => {
    if (e.target.checked) {
      updateQuestionResponse(
        currentQuestion,
        currentQuestion.options.map((opt) => opt.text)
      );
    } else {
      updateQuestionResponse(currentQuestion, []);
    }
  };

  const handleGridRadioChange = (rowIndex, colValue) => {
    if (
      !currentQuestion ||
      !currentQuestion.grid_rows ||
      rowIndex >= currentQuestion.grid_rows.length
    ) {
      console.error(
        "Cannot handle grid radio change: Invalid question data or rowIndex"
      );
      return;
    }
    const key = currentQuestion.sequence_number;
    const rowLabel =
      currentQuestion.grid_rows[rowIndex]?.text || `row-${rowIndex}`;

    setResponses((prev) => {
      const gridResponses = { ...(prev[key] || {}) };
      
      // Allow deselection by clicking the same value twice
      if (colValue === "N/A") {
        if (gridResponses[rowLabel] === "N/A") {
          // Deselect N/A by clearing the response
          delete gridResponses[rowLabel];
        } else {
          // Select N/A
          gridResponses[rowLabel] = "N/A";
        }
      } else {
        // Regular option selection
        if (gridResponses[rowLabel] === colValue) {
          // Deselect by clicking the same radio
          delete gridResponses[rowLabel];
        } else {
          // Select new option (this will automatically deselect N/A)
          gridResponses[rowLabel] = colValue;
        }
      }
      
      const newResponses = { ...prev, [key]: gridResponses };
      
      if (currentQuestion.question_uuid) {
        newResponses[currentQuestion.question_uuid] = gridResponses;
      }
      
      return newResponses;
    });
  };

  const handleGridCheckboxChange = (rowIndex, colValue) => {
    const key = currentQuestion.sequence_number;
    const rowLabel = currentQuestion.grid_rows[rowIndex]?.text || `row-${rowIndex}`;
    
    setResponses((prev) => {
      const gridResponses = { ...(prev[key] || {}) };
      const currentRowValues = gridResponses[rowLabel] || [];
      
      if (colValue === "N/A" || colValue === "_na_") {
        if (currentRowValues === "N/A") {
          // Deselect N/A
          delete gridResponses[rowLabel];
        } else {
          // Select N/A - clear all other selections for this row
          gridResponses[rowLabel] = "N/A";
        }
      } else {
        // Regular checkbox selection
        if (currentRowValues === "N/A") {
          // If N/A is selected, clear it and start fresh
          gridResponses[rowLabel] = [colValue];
        } else {
          let rowValues = Array.isArray(currentRowValues) ? currentRowValues : [];
          
          if (rowValues.includes(colValue)) {
            // Deselect the checkbox
            gridResponses[rowLabel] = rowValues.filter((v) => v !== colValue);
          } else {
            // Select the checkbox
            gridResponses[rowLabel] = [...rowValues, colValue];
          }
        }
      }
      
      const newResponses = { ...prev, [key]: gridResponses };
      
      if (currentQuestion.question_uuid) {
        newResponses[currentQuestion.question_uuid] = gridResponses;
      }
      
      return newResponses;
    });
  };

  const handleStarRatingChange = (rowIndex, colIndex, rating) => {
    const key = currentQuestion.sequence_number;
    const rowId = currentQuestion.grid_rows[rowIndex].text || rowIndex;
    const colId =
      currentQuestion.grid_columns && currentQuestion.grid_columns.length > 0
        ? currentQuestion.grid_columns[colIndex]?.text || colIndex
        : "Rating";

    setResponses((prev) => {
      const gridResponses = { ...(prev[key] || {}) };

      // Initialize the row object if it doesn't exist
      if (!gridResponses[rowId]) {
        gridResponses[rowId] = {};
      }

      // For N/A, set the entire row to N/A
      if (rating === "N/A") {
        gridResponses[rowId] = "N/A";
      } else {
        // If previously was N/A, reset to an object
        if (gridResponses[rowId] === "N/A") {
          gridResponses[rowId] = {};
        }
        // Set the rating for the specific column
        gridResponses[rowId][colId] = rating;
      }

      return { ...prev, [key]: gridResponses };
    });
  };

  const renderRankingInput = () => {
    return (
      currentQuestion.options &&
      currentQuestion.options.map((opt, idx) => (
        <div key={idx} style={styles.optionContainer}>
          <span>{opt.text} — Rank: </span>
          <input
            type="number"
            value={responses[currentQuestion.sequence_number]?.[opt.text] || ""}
            onChange={(e) => {
              const value = e.target.value;
              setResponses((prev) => {
                const ranking = {
                  ...(prev[currentQuestion.sequence_number] || {}),
                };
                ranking[opt.text] = value;
                return { ...prev, [currentQuestion.sequence_number]: ranking };
              });
            }}
            style={styles.rankingInput}
          />
        </div>
      ))
    );
  };

  const renderRadioGridInput = () => {
    if (!currentQuestion.grid_rows || !currentQuestion.grid_columns) {
      return <p>Grid configuration is incomplete.</p>;
    }
    // Get the response object for this question
    const responseGrid = responses[currentQuestion.sequence_number] || {};

    return (
      <div className="gridnew-container2">
        <table className="gridnew-table2">
        
          <thead>
            <tr>
              <th className="gridnew-header"></th>
              {currentQuestion.grid_columns.map((col, idx) => (
                <th key={idx} className="gridnew-header">
                  {col.text}
                </th>
              ))}
              {currentQuestion.not_applicable && (
                <th className="gridnew-header na-column">Not Applicable</th>
              )}
            </tr>
          </thead>
          <tbody>
            {currentQuestion.grid_rows.map((row, rowIdx) => {
              const rowLabel = row.text || `row-${rowIdx}`; // Get the label to check response state
              const rowResponse = responseGrid[rowLabel]; // Check response using the label
              const isNA = rowResponse === "N/A";

              return (
                <tr
                  key={rowIdx}
                  className={isNA ? "gridnew-row na-selected" : ""}
                >
                  <td className="gridnew-row-header">{row.text}</td>
                  {currentQuestion.grid_columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`gridnew-cell ${isNA ? "disabled" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`grid-${currentQuestion.sequence_number}-row-${rowIdx}`} // Name still uses rowIndex for grouping radios per row
                        // Check if the response for this rowLabel matches the current column's text
                        checked={!isNA && rowResponse === col.text}
                        // Pass rowIndex and col.text to handler
                        onChange={() => handleGridRadioChange(rowIdx, col.text)}
                        className={`gridnew-radio ${isNA ? "disabled" : ""}`}
                        disabled={isNA} // Disable radios if N/A is selected for the row
                      />
                    </td>
                  ))}
                  {currentQuestion.not_applicable && (
                    <td className="gridnew-cell na-column">
                      <div
                        className={`na-option ${isNA ? "selected" : ""}`}
                        // Pass rowIndex and 'N/A' to handler
                        onClick={() => handleGridRadioChange(rowIdx, "N/A")}
                      >
                        N/A
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCheckboxGridInput = () => {
    if (!currentQuestion.grid_rows || !currentQuestion.grid_columns) {
      return <p>Grid configuration is incomplete.</p>;
    }
    const responseData = responses[currentQuestion.sequence_number] || {};

    return (
      <div className="gridnew-container">
        <table className="gridnew-table">
          <thead>
            <tr>
              <th className="gridnew-header"></th>
              {currentQuestion.grid_columns.map((col, idx) => (
                <th key={idx} className="gridnew-header">
                  {col.text}
                </th>
              ))}
              {currentQuestion.not_applicable && (
                <th className="gridnew-header na-column">Not Applicable</th>
              )}
            </tr>
          </thead>
          <tbody>
            {currentQuestion.grid_rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={
                  responseData[rowIdx] === "N/A"
                    ? "gridnew-row na-selected"
                    : ""
                }
              >
                <td className="gridnew-row-header">{row.text}</td>
                {currentQuestion.grid_columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className={`gridnew-cell ${
                      responseData[rowIdx] === "N/A" ? "disabled" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={
                        Array.isArray(responseData[rowIdx]) &&
                        responseData[rowIdx].includes(col.text)
                      }
                      onChange={() =>
                        handleGridCheckboxChange(rowIdx, col.text)
                      }
                      className={`gridnew-checkbox ${
                        responseData[rowIdx] === "N/A" ? "disabled" : ""
                      }`}
                      disabled={responseData[rowIdx] === "N/A"}
                    />
                  </td>
                ))}
                {currentQuestion.not_applicable && (
                  <td className="gridnew-cell na-column">
                    <div
                      className={`na-option ${
                        responseData[rowIdx] === "N/A" ? "selected" : ""
                      }`}
                      onClick={() => handleGridCheckboxChange(rowIdx, "N/A")}
                    >
                      N/A
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderStarRatingGrid = () => {
    if (!currentQuestion.grid_rows) {
      return <p>Grid configuration is incomplete.</p>;
    }

    const responseData = responses[currentQuestion.sequence_number] || {};

    return (
      <div className="gridnew-container2">
        <table className="gridnew-table2">
          <tbody>
            {currentQuestion.grid_rows.map((row, rowIdx) => {
              const rowKey = `row-${rowIdx}`;
              const rowResponse = responseData[rowKey] || {};
              const isCellNA = rowResponse["rating"] === "N/A";
              const rating = !isCellNA ? rowResponse["rating"] || 0 : 0;

              return (
                <tr key={rowIdx} className="gridnew-row">
                  <td className="gridnew-row-header">{row.text}</td>
                  <td className="gridnew-cell star-rating-cell">
                    <div
                      className={`star-rating-container ${
                        isCellNA ? "na-selected" : ""
                      }`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <i
                          key={star}
                          className={`ri-star-${
                            rating >= star ? "fill" : "line"
                          }`}
                          onClick={() => {
                            if (!isCellNA) {
                              setResponses((prev) => {
                                const newData = {
                                  ...(prev[currentQuestion.sequence_number] ||
                                    {}),
                                };
                                if (!newData[rowKey]) newData[rowKey] = {};
                                newData[rowKey]["rating"] = star;
                                return {
                                  ...prev,
                                  [currentQuestion.sequence_number]: newData,
                                };
                              });
                            }
                          }}
                          style={{
                            cursor: isCellNA ? "default" : "pointer",
                            opacity: isCellNA ? 0.5 : 1,
                          }}
                        />
                      ))}
                    </div>
                  </td>
                  {currentQuestion.show_na && (
                    <td className="gridnew-cell na-column">
                      <div className="star-rating-na-option">
                        <label className="na-label">
                          <input
                            type="checkbox"
                            checked={isCellNA}
                            onChange={() => {
                              setResponses((prev) => {
                                const newData = {
                                  ...(prev[currentQuestion.sequence_number] ||
                                    {}),
                                };
                                if (!newData[rowKey]) newData[rowKey] = {};
                                newData[rowKey]["rating"] = isCellNA
                                  ? 0
                                  : "N/A";
                                return {
                                  ...prev,
                                  [currentQuestion.sequence_number]: newData,
                                };
                              });
                            }}
                            className="na-checkbox-input"
                          />
                          <span>{currentQuestion.not_applicable_text || "Not Applicable"}</span>
                        </label>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderQuestionInput = () => {
    if (!currentQuestion || !currentQuestion.question_type) {
      return <div>Invalid question configuration</div>;
    }

    switch (currentQuestion.question_type) {
      case "single-choice":
        const options = currentQuestion.options || [];
        const needsMultiColumn = options.length > 8;
        return (
          <div
            className={`choice-options-container ${
              needsMultiColumn ? "multi-column" : ""
            }`}
          >
            {currentQuestion.options &&
              Array.isArray(currentQuestion.options) &&
              currentQuestion.options.map((opt, idx) => {
                const optText = typeof opt === "object" ? opt?.text : opt;
                if (!optText) return null; // Skip invalid options

                const isChecked =
                  responses[currentQuestion.sequence_number] === optText;
                return (
                  <div key={idx} className="choice-option">
                    <label style={styles.singleChoiceLabel}>
                      <input
                        type="radio"
                        name={`q${currentQuestion.sequence_number}`}
                        value={optText}
                        checked={isChecked}
                        onChange={handleAnswerChange}
                        style={styles.hiddenRadioInput}
                      />
                      <span
                        style={
                          isChecked
                            ? styles.singleChoiceChecked
                            : styles.singleChoiceUnchecked
                        }
                      >
                        {isChecked && (
                          <i
                            className="ri-check-line"
                            style={{ color: "#fff", fontSize: "16px" }}
                          ></i>
                        )}
                      </span>
                      <span style={styles.singleChoiceText}>{optText}</span>
                    </label>
                  </div>
                );
              })}

            {/* Not Applicable Option */}
            {currentQuestion.show_na && (
              <div style={styles.singleChoiceContainer}>
                <label style={styles.singleChoiceLabel}>
                  <input
                    type="radio"
                    name={`q${currentQuestion.sequence_number}`}
                    value="_na_"
                    checked={
                      responses[currentQuestion.sequence_number] === "_na_"
                    }
                    onChange={handleAnswerChange}
                    style={styles.hiddenRadioInput}
                  />
                  <span
                    style={
                      responses[currentQuestion.sequence_number] === "_na_"
                        ? styles.singleChoiceChecked
                        : styles.singleChoiceUnchecked
                    }
                  >
                    {responses[currentQuestion.sequence_number] === "_na_" && (
                      <i
                        className="ri-check-line"
                        style={{ color: "#fff", fontSize: "16px" }}
                      ></i>
                    )}
                  </span>
                  <span style={styles.singleChoiceText}>{currentQuestion.not_applicable_text || "Not Applicable"}</span>
                </label>
              </div>
            )}

            {/* Other Option */}
            {currentQuestion.has_other_option && (
              <div style={styles.singleChoiceContainer}>
                <label style={styles.singleChoiceLabel}>
                  <input
                    type="radio"
                    name={`q${currentQuestion.sequence_number}`}
                    value="_other_"
                    checked={
                      responses[currentQuestion.sequence_number] === "_other_"
                    }
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setResponses((prev) => ({
                        ...prev,
                        [currentQuestion.sequence_number]: isChecked
                          ? "_other_"
                          : "",
                        [`${currentQuestion.sequence_number}_other_text`]:
                          prev[
                            `${currentQuestion.sequence_number}_other_text`
                          ] || "",
                      }));
                    }}
                    style={styles.hiddenRadioInput}
                  />
                  <span
                    style={
                      responses[currentQuestion.sequence_number] === "_other_"
                        ? styles.singleChoiceChecked
                        : styles.singleChoiceUnchecked
                    }
                  >
                    {responses[currentQuestion.sequence_number] ===
                      "_other_" && (
                      <i
                        className="ri-check-line"
                        style={{ color: "#fff", fontSize: "16px" }}
                      ></i>
                    )}
                  </span>
                  <span style={styles.singleChoiceText}>
                    {currentQuestion.other_option_text || "Other"}
                  </span>
                </label>

                {/* Other text input */}
                {responses[currentQuestion.sequence_number] === "_other_" && (
                  <div style={{ marginLeft: "35px", marginTop: "10px" }}>
                    <input
                      type="text"
                      value={
                        responses[
                          `${currentQuestion.sequence_number}_other_text`
                        ] || ""
                      }
                      onChange={(e) => {
                        setResponses((prev) => ({
                          ...prev,
                          [`${currentQuestion.sequence_number}_other_text`]:
                            e.target.value,
                        }));
                      }}
                      placeholder="Please specify..."
                      style={{
                        width: "100%",
                        padding: "10px",
                        backgroundColor: "transparent",
                        border: "1px solid #4F4F4F",
                        borderRadius: "5px",
                        color: "#fff",
                        fontSize: "14px",
                      }}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case "scale": {
        // Handles Scale (Likert) type
        // UPDATED: Use scale_points array instead of options
        const scalePoints = currentQuestion.scale_points || [];
        const needsMultiColumn = scalePoints.length > 8; // Apply multi-column logic if needed
        const currentResponse = responses[currentQuestion.sequence_number];
        const isNASelected = currentResponse === "N/A"; // N/A check remains the same

        return (
          <div className="scale-container">
            <div className={`scale-options-horizontal ${needsMultiColumn ? "scale-wrap" : ""}`}>
              {/* Iterate over scale_points */}
              {scalePoints.map((pointText, idx) => {
                if (!pointText) return null; // Skip empty points

                const isChecked = currentResponse === pointText; // Check against the point text

                return (
                  <div key={idx} className="scale-option-horizontal">
                    <div className="scale-option-text">{pointText}</div>
                    <label className="scale-radio-container">
                      <input
                        type="radio"
                        name={`q${currentQuestion.sequence_number}`}
                        value={pointText} // The value is the scale point text itself
                        checked={isChecked}
                        onChange={handleAnswerChange} // Use existing handler
                        disabled={isNASelected} // Disable if N/A is selected
                        className="scale-radio-input"
                      />
                      <span className={`scale-radio-button ${isChecked ? 'checked' : ''}`}>
                        {isChecked && (
                          <i className="ri-check-line" style={{ color: "#fff", fontSize: "14px" }}></i>
                        )}
                      </span>
                    </label>
                  </div>
                );
              })}
              {/* END UPDATED ITERATION */}

              {/* N/A Option logic remains the same, using show_na and not_applicable_text */}
              {currentQuestion.show_na && ( // Use show_na from question data
                <div className="scale-option-horizontal">
                  <div className="scale-option-text">
                    {currentQuestion.not_applicable_text || "Not Applicable"}
                  </div>
                  <label className="scale-radio-container">
                    <input
                      type="radio"
                      name={`q${currentQuestion.sequence_number}`}
                      value="N/A" // Explicit value for N/A
                      checked={isNASelected}
                      onChange={handleAnswerChange} // N/A selection handled by existing logic
                      className="scale-radio-input"
                    />
                    <span className={`scale-radio-button ${isNASelected ? 'checked' : ''}`}>
                      {isNASelected && (
                        <i className="ri-check-line" style={{ color: "#fff", fontSize: "14px" }}></i>
                      )}
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        );
      } // End scale case

      case "multi-choice": {
        const options = currentQuestion.options || [];
        const needsMultiColumn = options.length > 8;
        const currentResponses =
          responses[currentQuestion.sequence_number] || [];
        const hasNA = currentResponses.includes("N/A");
        const hasOther = currentResponses.some((r) => r.startsWith("other:"));
        const otherText =
          currentResponses.find((r) => r.startsWith("other:"))?.substring(6) ||
          "";

        return (
          <div
            className={`choice-options-container ${
              needsMultiColumn ? "multi-column" : ""
            }`}
          >
            {options.map((opt, idx) => {
              const optText = typeof opt === "object" ? opt?.text : opt;
              if (!optText) return null;

              const isChecked = currentResponses.includes(optText);

              return (
                <div key={idx} className="choice-option">
                  <label style={styles.singleChoiceLabel}>
                    <input
                      type="checkbox"
                      value={optText}
                      checked={isChecked}
                      onChange={(e) => handleCheckboxChange(optText)(e)}
                      disabled={hasOther}
                      style={styles.hiddenRadioInput}
                    />
                    <span
                      style={
                        isChecked
                          ? styles.checkboxChecked
                          : styles.checkboxUnchecked
                      }
                    >
                      {isChecked && (
                        <i
                          className="ri-check-line"
                          style={{ color: "#fff", fontSize: "16px" }}
                        ></i>
                      )}
                    </span>
                    <span className="choice-option-text">{optText}</span>
                  </label>
                </div>
              );
            })}

            {currentQuestion.has_other_option && (
              <div className="choice-option">
                <label style={styles.singleChoiceLabel}>
                  <input
                    type="checkbox"
                    value="other"
                    checked={hasOther}
                    disabled={hasNA}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setResponses((prev) => ({
                          ...prev,
                          [currentQuestion.sequence_number]: ["other:"],
                        }));
                      } else {
                        setResponses((prev) => ({
                          ...prev,
                          [currentQuestion.sequence_number]: [],
                        }));
                      }
                    }}
                    style={styles.hiddenRadioInput}
                  />
                  <span
                    style={
                      hasOther
                        ? styles.checkboxChecked
                        : styles.checkboxUnchecked
                    }
                  >
                    {hasOther && (
                      <i
                        className="ri-check-line"
                        style={{ color: "#fff", fontSize: "16px" }}
                      ></i>
                    )}
                  </span>
                  <span className="choice-option-text">
                    {currentQuestion.other_option_text || "Other"}
                  </span>
                </label>
                {hasOther && (
                  <input
                    type="text"
                    className="other-input"
                    value={otherText}
                    onChange={(e) => {
                      setResponses((prev) => ({
                        ...prev,
                        [currentQuestion.sequence_number]: [
                          `other:${e.target.value}`,
                        ],
                      }));
                    }}
                    placeholder="Please specify"
                  />
                )}
              </div>
            )}

            {currentQuestion.not_applicable && (
              <div className="choice-option">
                <label style={styles.singleChoiceLabel}>
                  <input
                    type="checkbox"
                    value="N/A"
                    checked={hasNA}
                    disabled={hasOther}
                    onChange={(e) => {
                      setResponses((prev) => ({
                        ...prev,
                        [currentQuestion.sequence_number]: e.target.checked
                          ? ["N/A"]
                          : [],
                      }));
                    }}
                    style={styles.hiddenRadioInput}
                  />
                  <span
                    style={
                      hasNA ? styles.checkboxChecked : styles.checkboxUnchecked
                    }
                  >
                    {hasNA && (
                      <i
                        className="ri-check-line"
                        style={{ color: "#fff", fontSize: "16px" }}
                      ></i>
                    )}
                  </span>
                  <span className="choice-option-text">
                    Not Applicable
                  </span>
                </label>
              </div>
            )}
          </div>
        );
      }

      case "dropdown":
        return (
          <div
            style={{
              width: "565px",
              position: "relative",
            }}
          >
            <select
              value={responses[currentQuestion.sequence_number] || ""}
              onChange={handleAnswerChange}
              style={{
                width: "100%",
                padding: "15px",
                backgroundColor: "transparent",
                border: "1px solid #4F4F4F",
                borderRadius: "10px",
                color: "#fff",
                fontFamily: "Poppins, sans-serif",
                fontSize: "15px",
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
              }}
            >
              <option
                value=""
                disabled
                style={{
                  backgroundColor: "#1a1a1a",
                  color: "#4F4F4F",
                }}
              >
                Select an option
              </option>
              {currentQuestion.options &&
                currentQuestion.options.map((opt, idx) => (
                  <option
                    key={idx}
                    value={typeof opt === "object" ? opt.text : opt}
                    style={{
                      backgroundColor: "#1a1a1a",
                      color: "#fff",
                      padding: "10px",
                    }}
                  >
                    {typeof opt === "object" ? opt.text : opt}
                  </option>
                ))}
            </select>
            <div
              style={{
                position: "absolute",
                right: "15px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "#AA2EFF",
              }}
            >
              <i
                className="ri-arrow-down-s-line"
                style={{ fontSize: "24px" }}
              ></i>
            </div>
          </div>
        );
      case "checkbox":
        return (
          <div>
            <div style={styles.optionContainer}>
              <label style={styles.optionLabel}>
                <input
                  type="checkbox"
                  name={`q${currentQuestion.sequence_number}-all`}
                  checked={
                    Array.isArray(responses[currentQuestion.sequence_number]) &&
                    currentQuestion.options &&
                    currentQuestion.options.every((opt) =>
                      responses[currentQuestion.sequence_number].includes(
                        opt.text
                      )
                    )
                  }
                  onChange={handleSelectAllCheckbox}
                  style={styles.checkboxInput}
                />
                All of the above
              </label>
            </div>
            {currentQuestion.options &&
              currentQuestion.options.map((opt, idx) => (
                <div key={idx} style={styles.optionContainer}>
                  <label style={styles.optionLabel}>
                    <input
                      type="checkbox"
                      name={`q${currentQuestion.sequence_number}`}
                      value={opt.text}
                      checked={
                        Array.isArray(
                          responses[currentQuestion.sequence_number]
                        ) &&
                        responses[currentQuestion.sequence_number].includes(
                          opt.text
                        )
                      }
                      onChange={handleCheckboxChange(opt.text)}
                      style={styles.checkboxInput}
                    />
                    {opt.text}
                  </label>
                </div>
              ))}
          </div>
        );
      case "content-text":
        return (
          <div className="content-text-container">
            <div
              className="content-text"
              dangerouslySetInnerHTML={{
                __html:
                  currentQuestion.question_text_html ||
                  currentQuestion.question_text ||
                  "",
              }}
            />
          </div>
        );

      case "content-media":
        const mediaUrl = currentQuestion.media_url || currentQuestion.image_url;
        const captionText = currentQuestion.caption || currentQuestion.question_text_html || currentQuestion.question_text || "";
        
        return (
          <div className="content-media-container">
            {captionText && (
              <div
                className="content-media-caption"
                dangerouslySetInnerHTML={{
                  __html: captionText,
                }}
              />
            )}
            {mediaUrl && (
              <div className="content-media-wrapper">
                {mediaUrl.toLowerCase().includes('.mp4') || mediaUrl.toLowerCase().includes('.webm') || mediaUrl.toLowerCase().includes('.ogg') ? (
                  <video 
                    src={mediaUrl.startsWith('http') || mediaUrl.startsWith('data:') ? mediaUrl : `${baseURL}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`} 
                    controls 
                    className="content-media-video"
                    alt="Content video"
                  />
                ) : (
                  <img 
                    src={mediaUrl.startsWith('http') || mediaUrl.startsWith('data:') ? mediaUrl : `${baseURL}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`} 
                    alt="Content media" 
                    className="content-media-image"
                  />
                )}
              </div>
            )}
          </div>
        );
      case "ranking":
        return renderRankingInput();
      case "open-ended":
        return (
          <textarea
            className="custom-textarea"
            value={responses[currentQuestion.sequence_number] || ""}
            onChange={handleAnswerChange}
            placeholder="Enter your answer"
          />
        );

      case "rating": {
        const min = Number(currentQuestion.rating_start ?? 1);
        const max = Number(currentQuestion.rating_end ?? 10);
        const step = Number(currentQuestion.rating_step ?? 1);
        const currentValue = Number(
          responses[currentQuestion.sequence_number] ?? min
        );

        const leftLabel = currentQuestion.left_label || "Low";
        const centerLabel = currentQuestion.center_label;
        const rightLabel = currentQuestion.right_label || "High";

        return (
          <div className="slider-wrapper">
            <div className="slider-labels">
              <span className="slider-label left">{leftLabel}</span>
              {centerLabel && centerLabel.trim() !== '' && (
                <span className="slider-label center">{centerLabel}</span>
              )}
              <span className="slider-label right">{rightLabel}</span>
            </div>

            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={currentValue}
              onChange={(e) => {
                if (responses[currentQuestion.sequence_number] !== "N/A") {
                  setResponses((prev) => ({
                    ...prev,
                    [currentQuestion.sequence_number]: Number(e.target.value),
                  }));
                }
              }}
              className="custom-slider"
              disabled={responses[currentQuestion.sequence_number] === "N/A"}
            />

            <div className="slider-min-max">
              <span>{min}</span>
              <span>{max}</span>
            </div>

            <div className="slider-value">
              {responses[currentQuestion.sequence_number] === "N/A"
                ? currentQuestion.not_applicable_text || "Not Applicable"
                : currentValue}
              {responses[currentQuestion.sequence_number] !== "N/A" &&
              currentQuestion.rating_unit
                ? ` ${currentQuestion.rating_unit}`
                : ""}
            </div>

            {currentQuestion.show_na && (
              <div className="choice-option">
                <label className="singleChoiceLabel">
                  <span
                    className={
                      responses[currentQuestion.sequence_number] === "N/A"
                        ? "checkbox-checked"
                        : "checkbox-unchecked"
                    }
                    onClick={(e) => {
                      setResponses((prev) => ({
                        ...prev,
                        [currentQuestion.sequence_number]:
                          prev[currentQuestion.sequence_number] === "N/A"
                            ? min
                            : "N/A",
                      }));
                    }}
                  >
                    {responses[currentQuestion.sequence_number] === "N/A" && (
                      <i className="ri-check-line check-icon"></i>
                    )}
                  </span>
                  <span className="choice-option-text na-text">
                    {currentQuestion.not_applicable_text || "Not Applicable"}
                  </span>
                </label>
              </div>
            )}
          </div>
        );
      }

      case "nps": {
        const currentValue = responses[currentQuestion.sequence_number];
        const isReversed = currentQuestion.nps_reversed;
        const spacing = currentQuestion.nps_spacing || 8;

        return (
          <div className="nps-container">
            <div className="nps-labels">
              <span>
                {currentQuestion.nps_left_label || "Not at all likely"}
              </span>
              <span>
                {currentQuestion.nps_right_label || "Extremely likely"}
              </span>
            </div>

            <div className="nps-buttons" style={{ gap: `${spacing}px` }}>
              {[...Array(11)].map((_, i) => {
                const value = isReversed ? 10 - i : i;
                const isSelected = currentValue === value;
                return (
                  <button
                    key={value}
                    onClick={() => {
                      setResponses((prev) => ({
                        ...prev,
                        [currentQuestion.sequence_number]: value,
                      }));
                    }}
                    className={`nps-button ${isSelected ? "selected" : ""}`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case "numerical-input": {
        const handleNumberChange = (e) => {
          const value = e.target.value;
          updateQuestionResponse(currentQuestion, value);
    
          if (
            !validateNumber(
              value,
              currentQuestion.min_value,
              currentQuestion.max_value
            )
          ) {
            let errorMsg = "Please enter a valid number.";
            if (
              currentQuestion.min_value != null &&
              currentQuestion.max_value != null
            ) {
              errorMsg = `Value must be between ${currentQuestion.min_value} and ${currentQuestion.max_value}.`;
            } else if (currentQuestion.min_value != null) {
              errorMsg = `Value must be at least ${currentQuestion.min_value}.`;
            } else if (currentQuestion.max_value != null) {
              errorMsg = `Value must not exceed ${currentQuestion.max_value}.`;
            }
            setNumberError(errorMsg);
          } else {
            setNumberError("");
          }
        };
    
        const inputProps = {};
        if (currentQuestion.min_value != null) {
          inputProps.min = currentQuestion.min_value;
        }
        if (currentQuestion.max_value != null) {
          inputProps.max = currentQuestion.max_value;
        }
    
        return (
          <div className="input-wrapper">
            <input
              type="number"
              value={responses[currentQuestion.sequence_number] || ""}
              onChange={handleNumberChange}
              {...inputProps}
              placeholder="Enter a number"
              className={`numerical-input ${numberError ? "error" : ""}`}
            />
            {numberError && <div className="error-message">{numberError}</div>}
          </div>
        );
      }
      case "email-input":
        return (
          <div className="input-wrapper">
            <input
              type="email"
              value={responses[currentQuestion.sequence_number] || ""}
              onChange={(e) =>
                handleEmailChange(e, currentQuestion.allowed_domains)
              }
              placeholder="Enter your email address"
              className={`email-input ${emailError ? "error" : ""}`}
            />
            {emailError && <div className="error-message">{emailError}</div>}
          </div>
        );
      case "date-picker":
        return (
          <div className="input-wrapper">
            <DatePicker
              selected={
                responses[currentQuestion.sequence_number]
                  ? new Date(responses[currentQuestion.sequence_number])
                  : null
              }
              onChange={(date) => {
                setResponses((prev) => ({
                  ...prev,
                  [currentQuestion.sequence_number]: date
                    ? date.toISOString()
                    : null,
                }));
              }}
              minDate={
                currentQuestion.min_date
                  ? new Date(currentQuestion.min_date)
                  : null
              }
              maxDate={
                currentQuestion.max_date
                  ? new Date(currentQuestion.max_date)
                  : null
              }
              dateFormat="yyyy-MM-dd"
              placeholderText="Select a date"
              className="survey-response-datepicker"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              yearDropdownItemNumber={100} // Shows 100 years in dropdown
              scrollableYearDropdown // Makes year dropdown scrollable
              openToDate={
                responses[currentQuestion.sequence_number]
                  ? new Date(responses[currentQuestion.sequence_number])
                  : new Date()
              } // Opens to selected date or current date
            />
          </div>
        );
      case "radio-grid":
        return renderRadioGridInput();
      case "checkbox-grid":
        return renderCheckboxGridInput();
      case "star-rating-grid":
        return renderStarRatingGrid();
      case "star-rating": {
        const currentValue = responses[currentQuestion.sequence_number];
        const isNA = currentValue === "N/A";

        return (
          <div className="gridnew-container2">
        
            <div className="star-rating-single-stars">
              {[1, 2, 3, 4, 5].map((rating) => (
                <i
                  key={rating}
                  className={`ri-star-${
                    !isNA && currentValue >= rating ? "fill" : "line"
                  }`}
                  onClick={() => {
                    if (!isNA) {
                      setResponses((prev) => ({
                        ...prev,
                        [currentQuestion.sequence_number]: rating,
                      }));
                    }
                  }}
                  style={{ opacity: isNA ? 0.5 : 1 }}
                ></i>
              ))}
            </div>

            {currentQuestion.show_na && (
              <div className="star-rating-single-na">
                <div
                  className={`na-option ${isNA ? "selected" : ""}`}
                  onClick={() => {
                    setResponses((prev) => ({
                      ...prev,
                      [currentQuestion.sequence_number]: isNA ? null : "N/A",
                    }));
                  }}
                >
                  N/A
                </div>
              </div>
            )}
          </div>
        );
      }
      case "single-image-select": {
        // Use HIDDEN_LABEL for state management
        const currentResponse = responses[currentQuestion.sequence_number]; // This will store the hidden_label
        const isNASelected = currentResponse === "N/A"; // Assuming 'N/A' is stored directly if selected

        return (
          <div className="image-select-container">
            <div className="image-options-grid">
              {(currentQuestion.image_options || []).map((option, idx) => {
                // Ensure option has necessary fields
                if (!option || !option.image_url || !option.hidden_label)
                  return null;

                const isSelected = currentResponse === option.hidden_label;

                return (
                  <div
                    key={option.hidden_label || idx} // Use hidden_label as key
                    className={`image-option ${isSelected ? "selected" : ""} ${
                      isNASelected ? "disabled" : ""
                    }`}
                    onClick={() => {
                      if (!isNASelected) {
                        setResponses((prev) => ({
                          ...prev,
                          // Store the HIDDEN_LABEL
                          [currentQuestion.sequence_number]:
                            option.hidden_label,
                        }));
                      }
                    }}
                  >
                    <div className="image-wrapper">
                      <img
                        src={`${baseURL}${option.image_url}`}
                        alt={option.label || `Option ${idx + 1}`} // Use label for alt text
                        className="option-image"
                      />
                      <div className="selection-indicator">
                        {/* Use existing radio/checkbox styles */}
                        <span
                          style={
                            isSelected
                              ? styles.singleChoiceChecked
                              : styles.singleChoiceUnchecked
                          }
                        >
                          {isSelected && (
                            <i
                              className="ri-check-line"
                              style={{ color: "#fff", fontSize: "16px" }}
                            ></i>
                          )}
                        </span>
                      </div>
                    </div>
                    {/* Display the VISIBLE label */}
                    <div className="image-label">
                      {option.label || `Option ${idx + 1}`}
                    </div>
                  </div>
                );
              })}
            </div>

            {currentQuestion.not_applicable && (
              <div className="na-option-container">
                <label className="na-label" style={styles.singleChoiceLabel}>
                  <input
                    type="radio"
                    name={`q${currentQuestion.sequence_number}`}
                    value="N/A"
                    checked={isNASelected}
                    onChange={(e) => {
                      setResponses((prev) => ({
                        ...prev,
                        [currentQuestion.sequence_number]: e.target.checked
                          ? "N/A"
                          : null,
                      }));
                    }}
                    style={styles.hiddenRadioInput} // Hide default radio
                  />
                  <span
                    style={
                      isNASelected
                        ? styles.singleChoiceChecked
                        : styles.singleChoiceUnchecked
                    }
                  >
                    {isNASelected && (
                      <i
                        className="ri-check-line"
                        style={{ color: "#fff", fontSize: "16px" }}
                      ></i>
                    )}
                  </span>
                  <span className="na-text">
                    {currentQuestion.not_applicable_text || "Not Applicable"}
                  </span>
                </label>
              </div>
            )}
          </div>
        );
      }

      case "multiple-image-select": {
        // Use HIDDEN_LABEL for state management
        const currentResponses =
          responses[currentQuestion.sequence_number] || []; // Should be an array of hidden_labels
        const hasNA = currentResponses.includes("N/A");

        return (
          <div className="image-select-container">
            <div className="image-options-grid">
              {(currentQuestion.image_options || []).map((option, idx) => {
                if (!option || !option.image_url || !option.hidden_label)
                  return null;

                const isSelected = currentResponses.includes(
                  option.hidden_label
                );

                return (
                  <div
                    key={option.hidden_label || idx}
                    className={`image-option ${isSelected ? "selected" : ""} ${
                      hasNA ? "disabled" : ""
                    }`}
                    onClick={() => {
                      if (!hasNA) {
                        const currentSelection =
                          responses[currentQuestion.sequence_number] || [];

                        // If deselecting, always allow
                        if (currentSelection.includes(option.hidden_label)) {
                          setResponses((prev) => {
                            const updatedSelection = currentSelection.filter(
                              (label) => label !== option.hidden_label
                            );
                            return {
                              ...prev,
                              [currentQuestion.sequence_number]:
                                updatedSelection,
                            };
                          });
                          return;
                        }

                        // If selecting, check max_selection
                        if (
                          currentQuestion.max_selection &&
                          currentSelection.length >=
                            currentQuestion.max_selection
                        ) {
                          toast.error(
                            `You can select maximum ${currentQuestion.max_selection} images`
                          );
                          return;
                        }

                        setResponses((prev) => ({
                          ...prev,
                          [currentQuestion.sequence_number]: [
                            ...currentSelection,
                            option.hidden_label,
                          ],
                        }));
                      }
                    }}
                  >
                    <div className="image-wrapper">
                      <img
                        src={`${baseURL}${option.image_url}`}
                        alt={option.label || `Option ${idx + 1}`}
                        className="option-image"
                      />
                      <div className="selection-indicator">
                        {/* Use existing checkbox styles */}
                        <span
                          style={
                            isSelected
                              ? styles.checkboxChecked
                              : styles.checkboxUnchecked
                          }
                        >
                          {isSelected && (
                            <i
                              className="ri-check-line"
                              style={{ color: "#fff", fontSize: "16px" }}
                            ></i>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="image-label">
                      {option.label || `Option ${idx + 1}`}
                    </div>
                  </div>
                );
              })}
            </div>

            {currentQuestion.not_applicable && (
              <div className="na-option-container">
                <label className="na-label" style={styles.singleChoiceLabel}>
                  <input
                    type="checkbox"
                    checked={hasNA}
                    onChange={(e) => {
                      setResponses((prev) => ({
                        ...prev,
                        [currentQuestion.sequence_number]: e.target.checked
                          ? ["N/A"]
                          : [],
                      }));
                    }}
                    style={styles.hiddenRadioInput} // Hide default checkbox
                  />
                  <span
                    style={
                      hasNA ? styles.checkboxChecked : styles.checkboxUnchecked
                    }
                  >
                    {hasNA && (
                      <i
                        className="ri-check-line"
                        style={{ color: "#fff", fontSize: "16px" }}
                      ></i>
                    )}
                  </span>
                  <span className="na-text">
                    {currentQuestion.not_applicable_text || "Not Applicable"}
                  </span>
                </label>
              </div>
            )}
          </div>
        );
      }

      case "document-upload": {
        const handleFileUpload = async (files) => {
          const allowedTypes = currentQuestion.file_types || [];
          const maxSize = (currentQuestion.max_file_size || 10) * 1024 * 1024;
          const maxFiles = currentQuestion.max_files || 1;

          if (files.length + uploadedFiles.length > maxFiles) {
            setUploadError(`Maximum ${maxFiles} files allowed`);
            return;
          }

          for (const file of files) {
            if (allowedTypes.length && !allowedTypes.includes(file.type)) {
              setUploadError("Invalid file type");
              return;
            }

            if (file.size > maxSize) {
              setUploadError(
                `File size must be less than ${currentQuestion.max_file_size}MB`
              );
              return;
            }

            try {
              const formData = new FormData();
              formData.append('document', file); // Change 'file' to 'document' to match server expectation
              
              // Call uploadDocument with individual parameters
              const response = await uploadAPI.uploadDocument(
                file,  // Pass the file directly
                surveyId, 
                currentQuestion.id || currentQuestion.sequence_number
              );
            
              // Rest of the success handling code...
              const data = response.data;
              console.log("Upload successful, data:", data);
            
              if (!data || !data.filePath) {
                throw new Error("Upload response missing file path.");
              }
            
              const newFile = {
                name: file.name,
                url: data.filePath,
                type: file.type,
                size: file.size,
              };
            
              setUploadedFiles((prev) => [...prev, newFile]);
              setResponses((prev) => ({
                ...prev,
                [currentQuestion.sequence_number]: [
                  ...(prev[currentQuestion.sequence_number] || []),
                  newFile,
                ],
              }));
              setUploadError("");
            } catch (err) {
              console.error("Upload error details:", err);
              // Log specific axios error details if available
              let errorMsg = "Upload failed: Please try again.";
              if (err.response) {
                console.error("Upload error response data:", err.response.data);
                errorMsg = `Upload failed: ${
                  err.response.data.error || err.response.statusText
                }`;
              } else if (err.request) {
                errorMsg = "Upload failed: No response from server.";
              } else if (err.message) {
                errorMsg = "Upload failed: " + err.message;
              }
              setUploadError(errorMsg);
              // Optionally: toast.error(errorMsg);
            }
          }
        };

        return (
          <div className="document-upload-container">
            <div
              className="upload-dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files);
                handleFileUpload(files);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <i className="ri-upload-cloud-line"></i>
              <p>Drag and drop files here or click to browse</p>
              {currentQuestion.file_types && (
                <span className="file-types">
                  Allowed types: {currentQuestion.file_types.join(", ")}
                </span>
              )}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                multiple={currentQuestion.max_files > 1}
                accept={currentQuestion.file_types?.join(",")}
                onChange={(e) => handleFileUpload(Array.from(e.target.files))}
              />
            </div>

            {uploadError && <div className="upload-error">{uploadError}</div>}

            {uploadedFiles.length > 0 && (
              <div className="uploaded-files">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="file-item">
                    <i className="ri-file-line"></i>
                    <span>{file.name}</span>
                    <button
                      onClick={() => {
                        const updatedFiles = uploadedFiles.filter(
                          (_, i) => i !== idx
                        );
                        setUploadedFiles(updatedFiles);
                        setResponses((prev) => ({
                          ...prev,
                          [currentQuestion.sequence_number]: updatedFiles,
                        }));
                      }}
                      className="remove-file"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case "interactive-ranking": {
        const handleDragEnd = (result) => {
          if (!result.destination) return;

          const items = Array.from(rankingItems);
          const [reorderedItem] = items.splice(result.source.index, 1);
          items.splice(result.destination.index, 0, reorderedItem);

          const updatedItems = items.map((item, index) => ({
            ...item,
            rank: index + 1,
          }));

          setRankingItems(updatedItems);

          const rankings = {};
          updatedItems.forEach((item) => {
            rankings[item.text] = item.rank;
          });

          setResponses((prev) => ({
            ...prev,
            [currentQuestion.sequence_number]: rankings,
          }));
        };

        if (!rankingItems || rankingItems.length === 0) {
          return <div>Loading ranking options...</div>;
        }

        return (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="ranking-list">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="ranking-list"
                >
                  {rankingItems.map((item, index) => (
                    <Draggable
                      key={item.id}
                      draggableId={item.id.toString()}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`ranking-item ${
                            snapshot.isDragging ? "dragging" : ""
                          }`}
                        >
                          <div className="rank-number">{index + 1}</div>
                          <div
                            {...provided.dragHandleProps}
                            className="drag-handle"
                          >
                            <i className="ri-drag-move-line"></i>
                          </div>
                          <div className="item-text">{item.text}</div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        );
      }
      case "signature":
        return (
          <div className="signature-container">
            <div className="signature-type-selector">
              <button
                className={`signature-type-button ${
                  signatureType === "draw" ? "active" : ""
                }`}
                onClick={() => setSignatureType("draw")}
              >
                <i className="ri-quill-pen-line"></i> Draw
              </button>
              <button
                className={`signature-type-button ${
                  signatureType === "type" ? "active" : ""
                }`}
                onClick={() => setSignatureType("type")}
              >
                <i className="ri-keyboard-line"></i> Type
              </button>
            </div>

            {signatureType === "draw" ? (
              <>
                <canvas 
                  ref={signatureRef} 
                  className="signature-canvas"
                  width={565}
                  height={200}
                />
                <div className="signature-footer">
                  <div className="signature-name-wrapper"></div>
                  <button
                    onClick={clearSignature}
                    className="signature-clear-btn"
                  >
                    Clear Signature
                  </button>
                </div>
              </>
            ) : (
              <div>
                <input
                  type="text"
                  className="signature-input"
                  placeholder="Type your name"
                  value={typedSignature}
                  onChange={(e) => {
                    setTypedSignature(e.target.value);
                    setResponses((prev) => ({
                      ...prev,
                      [currentQuestion.sequence_number]: {
                        type: "typed",
                        name: e.target.value,
                        font: selectedFont,
                      },
                    }));
                  }}
                />
                {typedSignature && (
                  <div className="signature-previews">
                    {signatureFonts.map((font, index) => (
                      <div
                        key={index}
                        className={`signature-preview-option ${
                          selectedFont === font.class ? "selected" : ""
                        }`}
                        onClick={() => {
                          setSelectedFont(font.class);
                          setResponses((prev) => ({
                            ...prev,
                            [currentQuestion.sequence_number]: {
                              type: "typed",
                              name: typedSignature,
                              font: font.class,
                            },
                          }));
                        }}
                      >
                        <div className="signature-preview-radio" />
                        <div
                          className="signature-preview-text"
                          style={{ fontFamily: font.class }}
                        >
                          {typedSignature}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={responses[currentQuestion.sequence_number] || ""}
            onChange={handleAnswerChange}
            style={styles.inputField}
            placeholder="Enter your answer"
          />
        );
    }
  };

  const isRequiredUnanswered = (q) => {
    const val = responses[q.sequence_number];
    if (!q.required) return false;

    if (q.question_type === "star-rating-grid") {
      const val = responses[q.sequence_number];
      if (!q.required) return false;
      if (!val || typeof val !== "object") return true;

      // Check if every row has either a rating or N/A selected
      return !q.grid_rows.every((_, rowIndex) => {
        const rowKey = `row-${rowIndex}`;
        const rowResponse = val[rowKey]?.rating;
        return (
          rowResponse === "N/A" ||
          (typeof rowResponse === "number" && rowResponse > 0)
        );
      });
    }

    if (!q.required) return false;

  if (["multi-choice", "multiple-image-select"].includes(q.question_type)) {
    const selectedCount = Array.isArray(val) ? val.length : 0;
    
    // Allow special option types to override minimum selection requirements
    const hasSpecialOption = Array.isArray(val) && val.some(item => 
      item === "N/A" || 
      item === "_na_" || 
      item === "_other_" ||
      (typeof item === 'string' && item.startsWith("other:"))
    );
    
    if (hasSpecialOption) {
      return false; // Special options satisfy the requirement
    }

    if (q.question_type === "radio-grid") {
      if (!val || typeof val !== "object") return true;

      // Check if every row has either an option selected or N/A selected
      return !q.grid_rows.every((row) => {
        const rowLabel = row.text || `row-${row.index}`;
        const rowResponse = val[rowLabel];
        return (
          rowResponse === "N/A" ||
          (typeof rowResponse === "string" && rowResponse.trim() !== "")
        );
      });
    }

    if (
      ["radio-grid", "checkbox-grid", "star-rating-grid"].includes(
        q.question_type
      )
    ) {
      if (!val || typeof val !== "object") return true;

      // Allow N/A responses to satisfy grid validation
      const hasSpecialGridResponse = Object.values(val).some((rowValue) => {
        return rowValue === "N/A" || rowValue === "_na_";
      });
      
      if (hasSpecialGridResponse) {
        return false; // N/A satisfies grid requirements
      }

      const hasAnyResponse = Object.values(val).some((rowValue) => {
        if (rowValue === "N/A") return true;
        if (Array.isArray(rowValue)) return rowValue.length > 0;
        return rowValue !== undefined && rowValue !== null && rowValue !== "";
      });

      return !hasAnyResponse;
    }

    if (q.question_type === "email-input") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof val !== "string" || val.trim() === "") return true;
      return !emailRegex.test(val.trim());
    }
    if (q.question_type === "numerical-input") {
      if (q.required) {
        if (!val || val.trim() === "") return true;
        return !validateNumber(val, q.min_value, q.max_value);
      } else {
        if (
          val &&
          val.trim() !== "" &&
          !validateNumber(val, q.min_value, q.max_value)
        )
          return true;
        return false;
      }
    }

    // Check for minimum selection requirements
    if (q.min_selection && selectedCount < q.min_selection) {
      return false; // Let the UI handle this validation
    }

    return selectedCount === 0; // Return true if no selections made
  }

  if (q.question_type === "radio-grid") {
    if (!val || typeof val !== "object") return true;

    // Check if every row has either an option selected or N/A selected
    return !q.grid_rows.every((row) => {
      const rowLabel = row.text || `row-${row.index}`;
      const rowResponse = val[rowLabel];
      return (
        rowResponse === "N/A" ||
        (typeof rowResponse === "string" && rowResponse.trim() !== "")
      );
    });
  }

  if (
    ["radio-grid", "checkbox-grid", "star-rating-grid"].includes(
      q.question_type
    )
  ) {
    if (!val || typeof val !== "object") return true;

    // Allow N/A responses to satisfy grid validation
    const hasSpecialGridResponse = Object.values(val).some((rowValue) => {
      return rowValue === "N/A" || rowValue === "_na_";
    });
    
    if (hasSpecialGridResponse) {
      return false; // N/A satisfies grid requirements
    }

    const hasAnyResponse = Object.values(val).some((rowValue) => {
      if (rowValue === "N/A") return true;
      if (Array.isArray(rowValue)) return rowValue.length > 0;
      return rowValue !== undefined && rowValue !== null && rowValue !== "";
    });

    return !hasAnyResponse;
  }

  if (!q.required) return false;

  if (typeof val === "object" && !Array.isArray(val)) {
    return q.options.some((opt) => {
      const entry = val[opt.text];
      return !entry || entry.toString().trim() === "";
    });
  }

  if (Array.isArray(val) && val.length === 0) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  if (val === undefined || val === null) return true;

  return false;
};






  const handleNext = () => {
    if (!currentQuestion) return; // Guard clause

    // Check if question is required and unanswered
    const validationResult = isRequiredUnanswered(currentQuestion);
    if (validationResult) {
      if (typeof validationResult === 'object' && validationResult.message) {
        // Use the specific error message from validation
        toast.error(validationResult.message, {
          position: "top-center",
          className: "required-toast",
          duration: 3000,
        });
      } else {
        // Default required message
        toast.error("This question is required.", {
          position: "top-center",
          className: "required-toast",
          duration: 2000,
        });
      }
      return;
    }

    // Additional validation for multi-choice questions even if not required
    if (["multi-choice", "multiple-image-select"].includes(currentQuestion.question_type)) {
      const selectedCount = Array.isArray(responses[currentQuestion.sequence_number]) 
        ? responses[currentQuestion.sequence_number].length 
        : 0;

      if (selectedCount > 0) { // Only validate if user has made selections
        if (currentQuestion.min_selection && selectedCount < currentQuestion.min_selection) {
          toast.error(`Please select at least ${currentQuestion.min_selection} option${currentQuestion.min_selection > 1 ? 's' : ''} to continue.`, { position: "top-center", className: "required-toast", duration: 2000, });
          return;
        }
        if (currentQuestion.max_selection && selectedCount > currentQuestion.max_selection) {
          toast.error(`Please select no more than ${currentQuestion.max_selection} option${currentQuestion.max_selection > 1 ? 's' : ''}.`, { position: "top-center", className: "required-toast", duration: 2000, });
          return;
        }
      }
    }

    if (checkDisqualification(currentQuestion, responses[currentQuestion.sequence_number])) {
      setIsDisqualified(true);
      setDisqualificationMessage(currentQuestion.disqualify_message || "You are disqualified from this survey.");
      return;
    }

    setShowAdditional(false);

    if (questionStartTime) {
      const now = new Date();
      const timeSpent = Math.floor((now - questionStartTime) / 1000);
      setResponseTimesData((prev) => ({
        ...prev,
        [currentQuestion.sequence_number]: timeSpent,
      }));
      setQuestionStartTime(now); // Reset for the next question
    }

    // Option-based Branching Logic (from your existing code)
    if (!branchFlow && (currentQuestion.question_type === "single-choice" || currentQuestion.question_type === "dropdown")) {
      const selectedAnswer = responses[currentQuestion.sequence_number];
      if (selectedAnswer && currentQuestion.branch && currentQuestion.options) {
        const optionIndex = currentQuestion.options.findIndex(
          (opt) => (typeof opt === 'object' ? opt.text : opt) === selectedAnswer
        );
        // Ensure currentQuestion.branch is an object/dictionary, not an array for option-based branching
        const branchData = currentQuestion.branch && typeof currentQuestion.branch === 'object' 
                           ? currentQuestion.branch[optionIndex] // Or currentQuestion.branch[selectedAnswer] if keys are option texts
                           : null;

        if (optionIndex !== -1 && branchData && branchData.questions && branchData.questions.length > 0) {
          const parentIndex = currentQuestionIndex;
          const resumeIndex = branchData.return_to_origin
            ? parentIndex + 1
            : branchData.jump_to_question
            ? parseInt(branchData.jump_to_question, 10) - 1 // Adjust for 0-based index
            : parentIndex + 1;

          setJumpStack((prev) => [...prev, { parentIndex, resumeIndex }]);
          setHasEnteredBranch(true); // This seems to be for option-based branching
          setBranchFlow({
            questions: branchData.questions,
            currentIndex: 0,
            parentOption: optionIndex, // Or selectedAnswer
            return_to_origin: branchData.return_to_origin,
            jump_to_question: branchData.jump_to_question,
          });
          return; // Exit early as we've entered a branch
        }
      }
    }
    
    // --- Conditional Logic for Skipping & Advancing ---
    let nextFlowIndex = branchFlow ? branchFlow.currentIndex + 1 : currentQuestionIndex + 1;
    const currentFlowQuestions = branchFlow ? branchFlow.questions : survey.questions;

    while (nextFlowIndex < currentFlowQuestions.length) {
      const potentialNextQuestion = currentFlowQuestions[nextFlowIndex];
      if (potentialNextQuestion && potentialNextQuestion.conditional_logic_rules) {
        if (shouldSkipQuestion(potentialNextQuestion.conditional_logic_rules, responses)) {
          console.log(`[Nav] Skipping Q${potentialNextQuestion.sequence_number} due to its conditional logic.`);
          setResponses(prev => {
            const upd = { ...prev };
            delete upd[potentialNextQuestion.sequence_number];
            return upd;
          });
          nextFlowIndex++;
          continue; // Check the next question in the current flow
        }
      }
      // If not skipped, this is the question to show
      break;
    }

    if (branchFlow) {
      if (nextFlowIndex < branchFlow.questions.length) {
        setBranchFlow((prev) => ({ ...prev, currentIndex: nextFlowIndex }));
      } else { // End of branch
        const lastJump = jumpStack.pop(); // Modifies jumpStack
        setBranchFlow(null);
        setHasEnteredBranch(false); // Exiting branch
        setLastExitedBranch({ // Store info about the branch we just exited
            branchFlow: { ...branchFlow, currentIndex: branchFlow.questions.length -1 }, // Store the state of the branch *before* exiting
            resumeIndex: lastJump ? lastJump.resumeIndex : currentQuestionIndex + 1
        });

        if (lastJump) {
            // After exiting a branch, determine the next main flow question considering its own conditional logic
            let mainFlowNextIndex = lastJump.resumeIndex;
            while (mainFlowNextIndex < survey.questions.length) {
                const potentialNextMainQ = survey.questions[mainFlowNextIndex];
                if (potentialNextMainQ && potentialNextMainQ.conditional_logic_rules && shouldSkipQuestion(potentialNextMainQ.conditional_logic_rules, responses)) {
                    mainFlowNextIndex++;
                } else {
                    break;
                }
            }
            if (mainFlowNextIndex < survey.questions.length) {
                setCurrentQuestionIndex(mainFlowNextIndex);
            } else {
                setShowThankYou(true);
            }
        } else { // Should not happen if jumpStack was managed correctly
            setShowThankYou(true);
        }
      }
    } else { // Main flow
      if (nextFlowIndex < survey.questions.length) {
        setCurrentQuestionIndex(nextFlowIndex);
      } else {
        setShowThankYou(true);
      }
    }
  }; // End of handleNext

  const handlePrevious = () => {
    setEmailError(""); // Reset any specific input errors
    setNumberError("");
    setShowAdditional(false);

    let targetIndex;
    let inBranch = !!branchFlow;

    if (inBranch) {
      targetIndex = branchFlow.currentIndex - 1;
      // console.log(`[Prev] In branch. Current branch index: ${branchFlow.currentIndex}. Targetting: ${targetIndex}`);

      while (targetIndex >= 0) {
        const potentialPrevQuestion = branchFlow.questions[targetIndex];
        if (potentialPrevQuestion && shouldSkipQuestion(potentialPrevQuestion.conditional_logic_rules, responses)) {
          // console.log(`[Prev] Skipping branched Q (Seq: ${potentialPrevQuestion.sequence_number}) at branch index ${targetIndex}`);
          setResponses(prev => {
            const upd = { ...prev };
            delete upd[potentialPrevQuestion.sequence_number];
            return upd;
          });
          targetIndex--;
        } else {
          break; // Found a question to show in branch or reached start of branch
        }
      }

      if (targetIndex >= 0) {
        // console.log(`[Prev] Moving to branch index: ${targetIndex}`);
        setBranchFlow(prev => ({ ...prev, currentIndex: targetIndex }));
      } else {
        // Reached the beginning of the branch, try to exit to parent
        // console.log(`[Prev] Reached start of branch. Attempting to exit.`);
        const lastJump = jumpStack.length > 0 ? jumpStack[jumpStack.length - 1] : null; // Peek, don't pop yet
        if (lastJump && lastJump.parentIndex !== undefined) {
          setJumpStack(prev => prev.slice(0, -1)); // Now pop
          setBranchFlow(null);
          setHasEnteredBranch(false); // No longer in an option-based branch
          // The question we land on (parentIndex) should NOT be skipped by its own logic
          // as it was the one that triggered the branch.
          // console.log(`[Prev] Exited branch. Moving to parent index: ${lastJump.parentIndex}`);
          setCurrentQuestionIndex(lastJump.parentIndex);
        } else {
          // console.log("[Prev] No parent jump info, or at the very start of survey if branch was first.");
          // This case implies we were in a branch that was the first thing shown,
          // or jumpStack is somehow corrupted. Can't go further back.
        }
      }
    } else { // In main flow
      targetIndex = currentQuestionIndex - 1;
      // console.log(`[Prev] In main flow. Current main index: ${currentQuestionIndex}. Targetting: ${targetIndex}`);

      while (targetIndex >= 0) {
        const potentialPrevQuestion = survey.questions[targetIndex];
        if (potentialPrevQuestion && shouldSkipQuestion(potentialPrevQuestion.conditional_logic_rules, responses)) {
          // console.log(`[Prev] Skipping main Q (Seq: ${potentialPrevQuestion.sequence_number}) at main index ${targetIndex}`);
          setResponses(prev => {
            const upd = { ...prev };
            delete upd[potentialPrevQuestion.sequence_number];
            return upd;
          });
          targetIndex--;
        } else {
          break; // Found a question to show in main flow or reached start of survey
        }
      }

      if (targetIndex >= 0) {
        // console.log(`[Prev] Moving to main index: ${targetIndex}`);
        setCurrentQuestionIndex(targetIndex);
        // After moving to a previous question in the main flow,
        // we need to check if THIS question *itself* triggers an option-based branch
        // based on its *current answer*. This handles re-entering a branch when going back.
        const newCurrentMainQuestion = survey.questions[targetIndex];
        if (newCurrentMainQuestion && 
            (newCurrentMainQuestion.question_type === "single-choice" || newCurrentMainQuestion.question_type === "dropdown")) {
            const selectedAnswer = responses[newCurrentMainQuestion.sequence_number];
            if (selectedAnswer && newCurrentMainQuestion.branch && newCurrentMainQuestion.options) {
                const optionIndex = newCurrentMainQuestion.options.findIndex(
                    (opt) => (typeof opt === 'object' ? opt.text : opt) === selectedAnswer
                );
                const branchData = newCurrentMainQuestion.branch && typeof newCurrentMainQuestion.branch === 'object' 
                                   ? newCurrentMainQuestion.branch[optionIndex]
                                   : null;

                if (optionIndex !== -1 && branchData && branchData.questions && branchData.questions.length > 0) {
                    // console.log(`[Prev] Re-entering branch from Q${newCurrentMainQuestion.sequence_number} (main index ${targetIndex})`);
                    // If re-entering, we typically want to go to the *last* question of that branch.
                    let lastBranchQuestionToShowIndex = branchData.questions.length - 1;
                    
                    // Iterate backwards through the branch to find the last non-skippable question
                    while(lastBranchQuestionToShowIndex >=0) {
                        const potentialLastBranchQ = branchData.questions[lastBranchQuestionToShowIndex];
                        if (potentialLastBranchQ && shouldSkipQuestion(potentialLastBranchQ.conditional_logic_rules, responses)) {
                            lastBranchQuestionToShowIndex--;
                        } else {
                            break;
                        }
                    }

                    if (lastBranchQuestionToShowIndex >= 0) {
                        setJumpStack(prev => [...prev, { parentIndex: targetIndex, resumeIndex: targetIndex + 1 }]); // Push parent context
                        setHasEnteredBranch(true);
                        setBranchFlow({
                            questions: branchData.questions,
                            currentIndex: lastBranchQuestionToShowIndex, // Go to last valid question in branch
                            parentOption: optionIndex,
                            return_to_origin: branchData.return_to_origin,
                            jump_to_question: branchData.jump_to_question,
                        });
                    }
                }
            }
        }

      } else {
        // console.log("[Prev] Reached start of survey.");
        // At the very beginning, nothing to do.
      }
    }
  };

  const clearSignature = () => {
    if (signatureType === "draw" && signatureRef.current) {
      const canvas = signatureRef.current;
      const ctx = canvas.getContext("2d");
      
      // Clear canvas completely first
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set fresh background
      ctx.fillStyle = currentQuestion.signature_options?.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Reset drawing style
      ctx.strokeStyle = currentQuestion.signature_options?.penColor || "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      console.log('Signature cleared');
    } else {
      setTypedSignature("");
      setSelectedFont(null);
    }

    setResponses((prev) => ({
      ...prev,
      [currentQuestion.sequence_number]: null,
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    // --- (Keep existing time calculation and validation logic) ---
    // Example:
    if (questionStartTime) {
      const now = new Date();
      const timeSpent = Math.floor((now - questionStartTime) / 1000);
      setResponseTimesData((prev) => ({
        ...prev,
        [currentQuestion.sequence_number]: timeSpent,
      }));
    }

    for (let q of survey.questions) {
      // Only validate questions that were actually shown to the user
      // Skip validation for questions that have conditional logic and would be skipped
      if (q.conditional_logic_rules && shouldSkipQuestion(q.conditional_logic_rules, responses)) {
        console.log(`[SUBMIT] Skipping validation for Q${q.sequence_number} due to conditional logic`);
        continue; // Skip validation for questions that are hidden by conditional logic
      }
      
      const validationResult = isRequiredUnanswered(q);
      if (validationResult) {
        if (typeof validationResult === 'object' && validationResult.message) {
          // Use the specific error message from validation
          toast.error(validationResult.message, { 
            position: "top-center", 
            className: "required-toast", 
            duration: 3000 
          });
        } else {
          // Default required message for other question types
          toast.error('This question is required.', { 
            position: "top-center", 
            className: "required-toast", 
            duration: 2000 
          });
        }
        setIsSubmitting(false);
        return;
      }
    }
    // --- End of validation/time logic ---

    let duration = null;
    if (surveyStartTime) {
      duration = Math.floor((new Date() - surveyStartTime) / 1000);
    }

    const formattedResponses = {};
    Object.entries(responses).forEach(([seq, response]) => {
      if (typeof response === "object" && !Array.isArray(response)) {
        const question = survey.questions.find(
          (q) => q.sequence_number.toString() === seq
        );
        if (
          question &&
          ["radio-grid", "checkbox-grid", "star-rating-grid"].includes(
            question.question_type
          )
        ) {
          formattedResponses[seq] = JSON.stringify(response);
        } else {
          formattedResponses[seq] = response;
        }
      } else {
        formattedResponses[seq] = response;
      }
    });

    // Prepare the response data payload
    const responsePayload = {
      responses: formattedResponses, // Your object mapping question_seq -> answer
      duration: duration,
      response_times: responseTimesData,
      user_agent: userAgentInfo,
      ...(loggedInUser && { user_id: loggedInUser.id }),
      // survey_link_id is needed if you track responses via specific links
      ...(surveyLinkId && { survey_link_id: parseInt(surveyLinkId) }),
    };

    console.log("Submitting survey response data:", responsePayload); // Log payload

    try {
      // Use the correct API method: submitResponse(surveyId, payload)
      const response = await surveyAPI.submitResponse(
        survey.id,
        responsePayload
      );
      console.log("Backend response:", response);
      
      // Axios successful response (2xx status)
      const responseData = response.data;
      console.log("Submission successful:", responseData);
      
      toast.success("Your responses have been saved. Thank you!", {
        position: "top-center",
        className: "success-toast",
        duration: 2000,
      });

      // IMPROVED: Enhanced user data refresh logic with proper timing and error handling
      if (loggedInUser) {
        try {
          console.log("[SURVEY_SUBMIT_FRONTEND] Submission successful. Waiting before refreshing user data...");
          
          // Wait a moment for backend transaction to fully commit
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log("[SURVEY_SUBMIT_FRONTEND] Attempting to refresh user data...");
          const updatedUserRes = await authAPI.getCurrentUser();
          
          if (updatedUserRes && updatedUserRes.data && updatedUserRes.data.user) {
            const updatedUser = updatedUserRes.data.user;
            
            // Log the changes for debugging
            const oldXP = loggedInUser.xp_balance || 0;
            const newXP = updatedUser.xp_balance || 0;
            const oldSurveyCount = loggedInUser.surveys_completed_count || 0;
            const newSurveyCount = updatedUser.surveys_completed_count || 0;
            
            console.log(`[SURVEY_SUBMIT_FRONTEND] User data updated:`);
            console.log(`  XP Balance: ${oldXP} -> ${newXP} (change: ${newXP - oldXP})`);
            console.log(`  Survey Count: ${oldSurveyCount} -> ${newSurveyCount} (change: ${newSurveyCount - oldSurveyCount})`);
            
            // Update localStorage with fresh user data
            localStorage.setItem("user", JSON.stringify(updatedUser));
            
            // Update the local state as well
            setLoggedInUser(updatedUser);
            
            console.log("[SURVEY_SUBMIT_FRONTEND] User data successfully refreshed and stored.");
            
            // If there were significant changes, show additional feedback
            if (newXP > oldXP) {
              const xpGained = newXP - oldXP;
              const questionCount = survey?.questions?.length || 0;
              toast.success(`🎉 You earned ${xpGained} XP for completing ${questionCount} question${questionCount !== 1 ? 's' : ''}!`, {
                position: "top-center",
                duration: 4000,
              });

              // Dispatch global XP event for navbar animation & audio
              window.dispatchEvent(new CustomEvent('xpGained', { detail: { amount: xpGained } }));
            }
            
            if (newSurveyCount > oldSurveyCount) {
              toast.success("📊 Survey completion recorded!", {
                position: "top-center",
                duration: 2000,
              });
            }
            
          } else {
            console.warn("[SURVEY_SUBMIT_FRONTEND] User data refresh returned invalid structure:", updatedUserRes);
            toast.warning("Survey saved, but profile data may need manual refresh.");
          }
          
        } catch (userFetchError) {
          console.error("Failed to re-fetch user data after submission:", userFetchError);
          console.error("Error details:", {
            message: userFetchError.message,
            response: userFetchError.response?.data,
            status: userFetchError.response?.status
          });
          
          // Don't fail the entire submission process for user data refresh issues
          toast.warning("Survey saved successfully, but your profile data may take a moment to update. Please refresh if needed.");
        }
      }

      // Navigate after a delay to allow toasts to show
      setTimeout(() => {
        navigate("/user/home"); // Navigate back to user home after survey completion
      }, 3000); // Increased delay to allow multiple toasts
      
    } catch (err) {
      // Handle errors using the interceptor's logging + user feedback
      console.error("Submit error:", err);
      console.error("Submit error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config
      });
      
      let errorMessage = "Error saving responses: Please try again.";
      // Extract specific error message from Axios error if available
      if (err.response && err.response.data && err.response.data.error) {
        errorMessage = `Error saving responses: ${err.response.data.error}`;
      } else if (err.message) {
        errorMessage = `Error saving responses: ${err.message}`;
      }
      
      toast.error(errorMessage, {
        position: "top-center",
        className: "error-toast",
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderThankYou = () => {
    return (
      <div className="thank-you-container">
        <h1 className="thank-you-title">Thank You!</h1>
        <p className="thank-you-message">
          We appreciate you taking the time to complete this survey. Your
          feedback is valuable to us.
        </p>
        <button className="submit-btn ripple" onClick={handleSubmit} disabled={isSubmitting}>
          Submit Response
        </button>
      </div>
    );
  };

  const renderDisqualification = () => {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <p
          style={{
            color: "#fff",
            fontFamily: "Clash Display, sans-serif",
            fontSize: "32px",
            lineHeight: "1.4",
            marginBottom: "40px",
            padding: "0 20px",
            fontWeight: "500",
          }}
        >
          {disqualificationMessage}
        </p>
        <button
          onClick={() => (window.location.href = "/surveys")}
          style={{
            background: "rgba(170, 46, 255, 0.1)",
            color: "#aa2eff",
            border: "1px solid #aa2eff",
            padding: "15px 40px",
            borderRadius: "8px",
            fontSize: "18px",
            fontFamily: "Poppins, sans-serif",
            cursor: "pointer",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#aa2eff";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "0 6px 20px rgba(170, 46, 255, 0.4)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(170, 46, 255, 0.1)";
            e.currentTarget.style.color = "#aa2eff";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          Return to Surveys
        </button>
      </div>
    );
  };

  if (!currentQuestion) {
    return <div>Error: No current question!</div>; // Add a guard
  }

  return (
    <div className="survey-response-container">
      <Toaster />
      <div className="header-wrapper">
        <header className="header">
          <div className="progress-counter"></div>
        </header>
      </div>
      <div className="divider-wrapper">
        <div className="colored-divider"></div>
      </div>

      {alreadyCompleted ? (
        <div className="thank-you-container">
          <h1 className="thank-you-title">Survey Complete</h1>
          <p className="thank-you-message">You have already completed this survey.</p>
        </div>
      ) : isDisqualified ? (
        renderDisqualification()
      ) : showThankYou ? (
        renderThankYou()
      ) : (
        <>
                  <section className="question-section">
          <div className="content-wrapper">
            {/* Only show question image and text if NOT content-text or content-media */}
            {!["content-text", "content-media"].includes(currentQuestion.question_type) && (
              <>
                {currentQuestion.image_url && (
                  <div className="question-image">
                    <img
                      src={`${baseURL}${currentQuestion.image_url}`}
                      alt="Question illustration"
                      className="question-image-content"
                    />
                  </div>
                )}

                <div className="question-text-container">
                  <div
                    className="questionText"
                    dangerouslySetInnerHTML={{
                      __html:
                        currentQuestion.question_text_html ||
                        currentQuestion.question_text ||
                        "",
                    }}
                  />
                  {currentQuestion.required && (
                    <span className="required-indicator">*</span>
                  )}
                </div>

                {currentQuestion.description && (
                  <div className="descriptionContainer">
                    <p className=".descriptionText">
                      {currentQuestion.description}
                    </p>
                  </div>
                )}
              </>
            )}

              <div className="answerContainer">
                {currentQuestion.additional_text && (
                  <>
                    <button
                      onClick={() => setShowAdditional(!showAdditional)}
                      className="info-button"
                      title="Show additional information"
                    >
                      <i
                        className="ri-information-line"
                        style={styles.icon}
                      ></i>
                    </button>
                    {showAdditional && (
                      <div className="additional-info">
                        {currentQuestion.additional_text}
                      </div>
                    )}
                  </>
                )}

                <div className="inputContainer">{renderQuestionInput()}</div>
              </div>

              <div className="section-divider"></div>

              <div className="navigation">
                <button
                  onClick={handlePrevious}
                  disabled={
                    branchFlow
                      ? branchFlow.currentIndex === 0 &&
                        currentQuestionIndex === 0
                      : currentQuestionIndex === 0
                  }
                  className="prevButton"
                >
                  <i className="ri-arrow-left-line"></i> Prev
                </button>

                <button onClick={handleNext} className="nextButton">
                  Next <i className="ri-arrow-right-line"></i>
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
;};

export default SurveyResponse;
