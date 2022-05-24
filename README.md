**Tab Isolator**

This Chrome extension isolates browser tabs so each tab can have its own logged in session.

Auth state is usually persisted in a cookie or localStorage, so this extension patches these web APIs to namespace the stored parameters to a particular tab. I chose to use the tabId as the namespace.

For localStorage the relevant patched methods look like this (see content.js for full code):

```
     // monkey-patch localStorage handling

    const tabNamespacedLocalStorage = {
      setItem: window.localStorage.setItem.bind(localStorage),
      getItem: window.localStorage.getItem.bind(localStorage),
      removeItem: window.localStorage.removeItem.bind(localStorage)
    }

    window.localStorage.setItem = (key, value) => {
      const tabId = getNamespace()
      tabNamespacedLocalStorage.setItem(tabId + key, value)
    }

    window.localStorage.getItem = (key) => {
      const tabId = getNamespace()
      return tabNamespacedLocalStorage.getItem(tabId + key)
    }

    window.localStorage.removeItem = (key) => {
      const tabId = getNamespace()
      tabNamespacedLocalStorage.removeItem(tabId + key)
    }

```

Sites that may store auth state in a cookie need different handling. Cookies can be set via headers, document.cookie methods, and thew new Cookie Store API. We'll focus on patching the first two to cover most use-cases. Sites created after the Cookie Store API was released are also likely to be using something better like localStorage for client-side storage. Here is an example of monkey-patching document.cookie methods, which simply add the namespace in front of the cookie name:

```
    Object.defineProperty(document, 'cookie', {
      get: () => {
        const storedCookieStr = cookieGetter()
        const processedCookieStr = processCookieStr(storedCookieStr)
        return processedCookieStr
      },

      set: (cookieString) => {
        const newValue = processSetCookieStr(cookieString)
        return cookieSetter(newValue)
      }
    })
```

Also, when the client sends requests to the server we'll want the cookie names to match what the server expects, so we'll strip the namespace when sending a request to the server. When we receive a request to set cookie, we'll want to save it namespaced. (see background.js for full code)

```
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
```

localStorage with monkey-patching worked well right out of the gate - its simple enough and the sites I tried had no issues. Cookies were another story. First, I dealt with a race condition where the content.js script would not load early enough before other scripts on the page. I had to make sure it was the first script loaded so I wrote some code in content.js that injects the script into the head. There were other issues with cookie-based-auth sites where sometimes, some cookies were not saved namespaced. I had timeboxed myself so I ran out of time to fully debug, but theoretically my strategy should work with a small number of tabs open for the same site. Where it would fail is when we hit the limit with what can be saved in a cookie. We'd need to at that point switch to saving the namespaced cookie parameters elsewhere, like localStorage, and then only loading into the cookie the relevant tab, rather than all namespaced cookie names and values. We are also ignoring the few sites that may use the Cookie Store API, which should be negligible.