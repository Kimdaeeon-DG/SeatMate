// Netlify 서버리스 함수: 관리자 비밀번호를 환경 변수에서 가져옴
exports.handler = async function(event, context) {
  // HTTP 메서드 확인 (GET만 허용)
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 환경 변수에서 비밀번호 가져오기
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    // 비밀번호가 설정되지 않은 경우 오류 반환
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다.');
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: '환경 변수가 설정되지 않았습니다. Netlify 대시보드에서 ADMIN_PASSWORD 환경 변수를 설정해주세요.' 
        })
      };
    }
    
    // 성공적으로 비밀번호 반환
    return {
      statusCode: 200,
      body: JSON.stringify({ password: adminPassword })
    };
  } catch (error) {
    console.error('비밀번호 가져오기 오류:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '서버 오류' })
    };
  }
};
