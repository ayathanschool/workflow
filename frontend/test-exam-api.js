// Quick test for exam marks API
console.log('Testing Exam Management API...');

// Test if the basic API is working
fetch('https://script.google.com/macros/s/AKfycbxb3eCcrPwNyzeaYZJBFPyxESd2xWnnhjt2Q_XmnH-UXGneJyGHvxCrFMCow_iNGjGp/exec?action=ping')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Ping test:', data);
    
    // Test getting exams
    return fetch('https://script.google.com/macros/s/AKfycbxb3eCcrPwNyzeaYZJBFPyxESd2xWnnhjt2Q_XmnH-UXGneJyGHvxCrFMCow_iNGjGp/exec?action=getExams');
  })
  .then(response => response.json())
  .then(data => {
    console.log('✅ Get Exams test:', data);
    if (data && data.length > 0) {
      const firstExam = data[0];
      console.log('First exam:', firstExam);
      
      // Test getting marks for first exam
      return fetch(`https://script.google.com/macros/s/AKfycbxb3eCcrPwNyzeaYZJBFPyxESd2xWnnhjt2Q_XmnH-UXGneJyGHvxCrFMCow_iNGjGp/exec?action=getExamMarks&examId=${firstExam.examId}`);
    } else {
      console.log('No exams found to test');
      return null;
    }
  })
  .then(response => {
    if (response) {
      return response.json();
    }
    return null;
  })
  .then(data => {
    if (data) {
      console.log('✅ Get Exam Marks test:', data);
    }
  })
  .catch(error => {
    console.error('❌ API Test failed:', error);
  });