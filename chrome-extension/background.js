function getNamespace(tabCallback) {
  return chrome.tabs.query(
    {
      active: true,
      currentWindow: true
    },
    ([currentTab]) => {
      if (currentTab && currentTab['id']) {
        return tabCallback('tab' + currentTab.id)
      }
    }
  )
}

const isHeader = (requestHeader, headerName) =>
  requestHeader.name.toLowerCase() === headerName

const isCookieHeader = (requestHeader) => isHeader(requestHeader, 'cookie')

const isSetCookieHeader = (requestHeader) =>
  isHeader(requestHeader, 'set-cookie')

const processCookieStr = (cookiesStr, prefix) => {
  const cookieStrList = cookiesStr.split(' ')
  const newStrList = []
  cookieStrList.forEach((cookieStr) => {
    if (cookieStr.indexOf(prefix) === 0) {
      newStrList.push(cookieStr.substring(prefix.length, cookieStr.length))
    }
  })
  return newStrList.join(' ')
}

const processSetCookieStr = (str, prefix) => {
  return `${prefix}${str}`
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.getTabId) {
    sendResponse({ tab: sender.tab.id })
  }
})

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    return getNamespace((namespace) => {
      details.requestHeaders.forEach((requestHeader) => {
        if (isCookieHeader(requestHeader)) {
          requestHeader.value = processCookieStr(requestHeader.value, namespace)
        }
      })

      return {
        requestHeaders: details.requestHeaders
      }
    })
  },
  {
    urls: ['<all_urls>']
  },
  ['blocking', 'requestHeaders', 'extraHeaders']
)

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    return getNamespace((namespace) => {
      details.responseHeaders.forEach((responseHeader) => {
        if (isSetCookieHeader(responseHeader)) {
          responseHeader.value = processSetCookieStr(
            responseHeader.value,
            namespace
          )
        }
      })

      return {
        responseHeaders: details.responseHeaders
      }
    })
  },
  {
    urls: ['<all_urls>']
  },
  ['blocking', 'responseHeaders', 'extraHeaders']
)
