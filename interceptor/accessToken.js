import interceptor from 'rest/interceptor'
import rest from 'rest'
import when from 'when'
import session from '../utils/accessTokenSession'

const noSSR = 'singleClient'

function getAccessToken (clientId, uuid, renew) {
  try {
    if (!session.accessTokens.hasOwnProperty(uuid) || renew) {
      session.accessTokens[uuid] = when.promise((resolve, reject) => {
        rest({
          method: 'GET',
          path: 'auth/access-token',
          params: { client_id: clientId },
          withCredentials: true
        }).then(response => {
          if (response.status.code === 200) {
            resolve(JSON.parse(response.entity).access_token)
          } else {
            reject(response.status.code)
          }
        })
      })
    }

    return session.accessTokens[uuid]
  } catch (e) {
    console.error(e)
  }
}

function updateHeaders (request, accessToken) {
  try {
    if (!accessToken) throw new Error('Empty access-token provided!')

    let headers

    headers = request.headers || (request.headers = {})
    headers.Authorization = `Bearer ${accessToken}`
  } catch (e) {
    console.error(e)
  }
}

function getClientId (request, config) {
  try {
    const { params } = request
    if (params && (params.client_id || params.clientId || params.clientID)) {
      return params.client_id || params.clientId || params.clientID
    } else {
      return config.clientId
    }
  } catch (e) {
    console.error(e)
  }
}

export default interceptor({
  request: function (request, config) {
    try {
      return request.accessToken === false
        ? request
        : getAccessToken(getClientId(request, config), config.uuid || noSSR).then(accessToken => {
          updateHeaders(request, accessToken)
          return request
        })
    } catch (e) {
      console.error(e)
    }
  },

  response: function (response, config, meta) {
    try {
      // Init a virtual session linked to the uuid if the accessToken parameter is provided.
      if (response.request.accessToken === false) {
        session.initAccessTokenSession(config.uuid, JSON.parse(response.entity).access_token)
      }
      // Check for invalid access-token status codes.
      if (response.status.code === 401 || response.status.code === 0) {
        // Perform the request again after renewing the access-token.
        return getAccessToken(
          getClientId(response.request, config),
          config.uuid || noSSR,
          true
        ).then(accessToken => {
          updateHeaders(response.request, accessToken)

          return meta.client(response.request)
        })
      }

      return response
    } catch (e) {
      console.error(e)
    }
  }
})
