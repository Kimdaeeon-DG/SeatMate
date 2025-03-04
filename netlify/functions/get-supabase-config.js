// Netlify 서버리스 함수: Supabase 설정을 환경 변수에서 가져옴
exports.handler = async function(event, context) {
  // HTTP 메서드 확인 (GET만 허용)
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 환경 변수에서 Supabase 설정 가져오기
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    // 설정이 없는 경우 오류 반환
    if (!supabaseUrl || !supabaseKey) {
      console.error('SUPABASE_URL 또는 SUPABASE_KEY 환경 변수가 설정되지 않았습니다.');
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: '환경 변수가 설정되지 않았습니다. Netlify 대시보드에서 SUPABASE_URL과 SUPABASE_KEY 환경 변수를 설정해주세요.' 
        })
      };
    }
    
    // 성공적으로 설정 반환
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        url: supabaseUrl,
        key: supabaseKey
      })
    };
  } catch (error) {
    console.error('Supabase 설정 가져오기 오류:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '서버 오류' })
    };
  }
};
