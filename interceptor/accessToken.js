import interceptor from 'rest/interceptor'
import parse from 'url-parse'

function updateHeaders (request, accessToken) {
  let headers

  headers = request.headers || (request.headers = {})
  headers.Authorization = `Bearer ${accessToken}`

  return headers
}

function needsAccessToken (pathname) {
  return (/^\/*auth\/(?!logout).*$/i).test(pathname) === false &&
    (/api\/v1\/helpers\//i).test(pathname) === false
}

function isAccessTokenRequest (pathname) {
  return (/^\/*auth\/(access-token|login|oauth-login|password-reset\/[A-Za-z0-9]*)$/i).test(pathname)
}

export default interceptor({
  init (config) {
    config.onAccessToken = config.onAccessToken || (f => f)
    return config
  },

  request (request, config) {
    const { pathname } = parse(request.path)

    if (needsAccessToken(pathname) === true) {
      request.headers = updateHeaders(request, request.accessToken || config.token)
    }

    return request
  },

  response (response, config, meta) {
    const { pathname } = parse(response.request.path)
    if (isAccessTokenRequest(pathname) && response.status && response.status.code === 200 && response.entity.access_token) {
      config.onAccessToken(response.entity.access_token)
    }

    return response
  }
})
