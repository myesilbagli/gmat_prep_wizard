import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/HomePage'
import { MyWordsPage } from './pages/MyWordsPage'
import { WordDetailPage } from './pages/WordDetailPage'
import { LearnPage } from './pages/LearnPage'
import { TestPage } from './pages/TestPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/words" element={<MyWordsPage />} />
        <Route path="/words/:wordId" element={<WordDetailPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/test" element={<TestPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
