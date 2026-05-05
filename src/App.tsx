import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/HomePage'
import { MyWordsPage } from './pages/MyWordsPage'
import { WordDetailPage } from './pages/WordDetailPage'
import { LearnPage } from './pages/LearnPage'
import { TestPage } from './pages/TestPage'
import { SessionPage } from './pages/SessionPage'
import { ExamHubPage } from './pages/ExamHubPage'
import { RcSetupPage } from './pages/RcSetupPage'
import { RcPracticePage } from './pages/RcPracticePage'
import { RcReviewPage } from './pages/RcReviewPage'
import { LandingPage } from './pages/LandingPage'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { TermsOfServicePage } from './pages/TermsOfServicePage'
import { APP_HOME } from './lib/routes'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/session" element={<SessionPage />} />
      <Route path="/exam/rc/practice/:attemptId" element={<RcPracticePage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route element={<AppLayout />}>
        <Route path={APP_HOME} element={<HomePage />} />
        <Route path="/words" element={<MyWordsPage />} />
        <Route path="/words/:wordId" element={<WordDetailPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/exam" element={<ExamHubPage />} />
        <Route path="/exam/rc/setup" element={<RcSetupPage />} />
        <Route path="/exam/rc/review/:attemptId" element={<RcReviewPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
