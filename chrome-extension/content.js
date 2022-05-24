chrome.runtime.sendMessage({ getTabId: true }, (tab) => {
  const code =
    `
    const cookieGetter = document.__lookupGetter__("cookie").bind(document);
    const cookieSetter = document.__lookupSetter__("cookie").bind(document);

    const getNamespace = () => {
      return 'tab' + ` +
    tab.tab +
    `
    }

    // monkey-patch document.cookie handling

    const processCookieStr = (cookiesStr) => {
      const prefix = getNamespace()
      const cookieStrList = cookiesStr.split(' ')
      const newStrList = []
      cookieStrList.forEach((cookieStr) => {
        if (cookieStr.indexOf(prefix) === 0) {
          newStrList.push(cookieStr.substring(prefix.length, cookieStr.length))
        }
      })
      return newStrList.join(' ')
    }

    const processSetCookieStr = (str) => {
      return getNamespace() + str
    }

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
`

  const script = document.createElement('script')
  script.textContent = code
  ;(document.head || document.documentElement).appendChild(script)
  script.remove()
})
