/* global app, angular */

/**
 * Main App Controller -- Manage all emails visible in the list
 */
let refreshTimeout = null
let notificationTimeout = null
const DEFAULT_EMAILS_PAGE_SIZE = 25
const EMAILS_PAGE_SIZE_OPTIONS = [25, 50, 100]

app.controller('MainCtrl', [
  '$scope', '$rootScope', '$http', 'Email', '$route', '$location', 'Favicon',
  function ($scope, $rootScope, $http, Email, $route, $location, Favicon) {
    $scope.notificationsSupported = 'Notification' in window && window.isSecureContext

    $scope.itemsLoading = true
    $scope.items = []
    $scope.currentItemId = null
    $scope.mailListFilter = 'all'
    $scope.loadingMore = false
    $scope.hasMoreItems = true
    $scope.nextSkip = 0
    $scope.unreadItems = 0
    $scope.metrics = { total: 0, unread: 0, read: 0 }
    $scope.dashboardMetrics = { totalReceived: 0, inboxCount: 0, inboxUnread: 0, inboxRead: 0 }
    $scope.shareCount = 0
    $scope.navMoreOpen = false
    $scope.deleteAllSafeguard = true

    const settingsKey = 'maildevSettings'

    const saveSettings = function () {
      if (window.localStorage) {
        window.localStorage.setItem(settingsKey, JSON.stringify($scope.settings))
      }
    }

    const loadSettings = function (defaultSettings) {
      try {
        const settingsJSON = window.localStorage.getItem(settingsKey)
        return Object.assign({}, defaultSettings, JSON.parse(settingsJSON))
      } catch (err) {
        console.error('Error loading InboxLab settings', err)
        return defaultSettings
      }
    }

    const defaultSettings = {
      notificationsEnabled: false,
      autoShowEnabled: false,
      darkThemeEnabled: false,
      pageSize: DEFAULT_EMAILS_PAGE_SIZE
    }
    $scope.settings = loadSettings(defaultSettings)
    $scope.pageSizeOptions = EMAILS_PAGE_SIZE_OPTIONS
    if (!EMAILS_PAGE_SIZE_OPTIONS.includes(Number($scope.settings.pageSize))) {
      $scope.settings.pageSize = DEFAULT_EMAILS_PAGE_SIZE
      saveSettings()
    }

    const i18nKey = 'maildevLanguage'
    const translations = {
      en: {
        inbox: 'Inbox',
        searchInMail: 'Search in mail',
        all: 'All',
        read: 'Read',
        unread: 'Unread',
        loading: 'Loading...',
        noEmails: 'No emails',
        noSender: '(No sender)',
        noSubject: '(No subject)',
        toPrefix: 'To:',
        refreshEmails: 'Refresh emails',
        markAllRead: 'Mark all emails as read',
        toggleTheme: 'Toggle between light and dark theme',
        additionalConfig: 'Additional configuration',
        emailsPerLoad: 'Emails per page',
        browserNotifications: 'Browser notifications',
        openNewMail: 'Open new mail',
        filter: 'Filter:',
        clearFilter: 'Clear filter',
        copy: 'Copy',
        generateLink: 'Generate link',
        generateLinkPlaceholder: 'Generate mailbox link',
        total: 'Total',
        unreadMetric: 'Unread',
        readMetric: 'Read',
        showing: 'Showing',
        fromLabel: 'From',
        toLabel: 'To',
        emptyInboxTitle: 'Your inbox is empty',
        emptyInboxDescription: 'When new messages arrive they will appear here.',
        smtpHost: 'Host',
        smtpPort: 'Port',
        smtpUsername: 'Username',
        smtpPassword: 'Password',
        smtpSSL: 'SSL',
        enabled: 'Enabled',
        disabled: 'Disabled',
        notAvailable: 'N/A',
        html: 'HTML',
        text: 'Text',
        attachments: 'Attachments',
        headers: 'Headers',
        source: 'Source',
        download: 'Download',
        relay: 'Relay',
        relayTo: 'Relay to...',
        delete: 'Delete',
        cc: 'Cc',
        bcc: 'Bcc',
        open: 'Open',
        noPreview: 'No preview available for this file type.',
        noAttachments: 'This email has no attachments.',
        filterParams: 'Filter params',
        overview: 'Overview',
        shareInbox: 'Share this inbox',
        sharedTimes: 'Shared times',
        dashboardMetrics: 'Metrics',
        totalMailsReceived: 'Total mails received',
        mailsForThisInbox: 'for this inbox',
        smtpConfig: 'SMTP Configuration',
        invalidEmail: 'The specified email address is not correct.',
        relayNotConfigured: 'Relay feature has not been configured.\nRun maildev --help for configuration info.',
        relayConfirm: 'Are you sure you want to REALLY SEND email to ',
        throughHost: ' through ',
        relaySuccess: 'Relay successful',
        relayFailed: 'Relay failed: '
      },
      es: {
        inbox: 'Bandeja',
        searchInMail: 'Buscar en correos',
        all: 'Todos',
        read: 'Leidos',
        unread: 'No leidos',
        loading: 'Cargando...',
        noEmails: 'Sin correos',
        noSender: '(Sin remitente)',
        noSubject: '(Sin asunto)',
        toPrefix: 'Para:',
        refreshEmails: 'Actualizar correos',
        markAllRead: 'Marcar todos como leidos',
        toggleTheme: 'Cambiar tema claro/oscuro',
        additionalConfig: 'Configuracion adicional',
        emailsPerLoad: 'Correos por pag.',
        browserNotifications: 'Notificaciones del navegador',
        openNewMail: 'Abrir nuevo correo',
        filter: 'Filtro:',
        clearFilter: 'Quitar filtro',
        copy: 'Copiar',
        generateLink: 'Generar enlace',
        generateLinkPlaceholder: 'Generar enlace del mailbox',
        total: 'Total',
        unreadMetric: 'No leidos',
        readMetric: 'Leidos',
        showing: 'Mostrando',
        fromLabel: 'From',
        toLabel: 'To',
        emptyInboxTitle: 'Tu bandeja esta vacia',
        emptyInboxDescription: 'Cuando lleguen nuevos mensajes apareceran aqui.',
        smtpHost: 'Host',
        smtpPort: 'Port',
        smtpUsername: 'Usuario',
        smtpPassword: 'Contrasena',
        smtpSSL: 'SSL',
        enabled: 'Habilitado',
        disabled: 'Deshabilitado',
        notAvailable: 'N/A',
        html: 'HTML',
        text: 'Texto',
        attachments: 'Adjuntos',
        headers: 'Encabezados',
        source: 'Fuente',
        download: 'Descargar',
        relay: 'Reenviar',
        relayTo: 'Reenviar a...',
        delete: 'Eliminar',
        cc: 'Cc',
        bcc: 'Bcc',
        open: 'Abrir',
        noPreview: 'No hay vista previa para este tipo de archivo.',
        noAttachments: 'Este correo no tiene adjuntos.',
        filterParams: 'Parametros de filtro',
        overview: 'Resumen',
        shareInbox: 'Compartir esta bandeja',
        sharedTimes: 'Veces compartido',
        dashboardMetrics: 'Metricas',
        totalMailsReceived: 'Correos totales recibidos',
        mailsForThisInbox: 'para esta bandeja',
        smtpConfig: 'Configuracion SMTP',
        invalidEmail: 'El correo especificado no es valido.',
        relayNotConfigured: 'La funcion de reenvio no esta configurada.\nEjecuta maildev --help para mas informacion.',
        relayConfirm: 'Seguro que deseas reenviar el correo a ',
        throughHost: ' a traves de ',
        relaySuccess: 'Reenvio exitoso.',
        relayFailed: 'Reenvio fallido: '
      }
    }

    $scope.language = window.localStorage?.getItem(i18nKey) || 'es'
    if (!translations[$scope.language]) $scope.language = 'es'

    $scope.t = function (key) {
      return translations[$scope.language]?.[key] || translations.en[key] || key
    }

    $scope.toggleLanguage = function () {
      $scope.language = $scope.language === 'es' ? 'en' : 'es'
      if (window.localStorage) window.localStorage.setItem(i18nKey, $scope.language)
    }

    const getActiveFilters = function () {
      const search = $location.search() || {}
      return {
        key: search.u || search.key || '',
        from: search.from || $route.current?.params?.from || '',
        to: search.to || $route.current?.params?.to || ''
      }
    }

    const buildShareUrl = function () {
      const filters = getActiveFilters()
      const key = filters.key || $scope.config?.filterKey || ''
      if (!key) return ''
      const url = new URL(window.location.href)
      url.searchParams.delete('view')
      url.searchParams.delete('u')
      url.searchParams.delete('from')
      url.searchParams.delete('to')
      url.searchParams.set('u', key)
      return url.toString()
    }

    const getShareCountStorage = function () {
      try {
        return JSON.parse(window.localStorage.getItem('maildevShareCounts') || '{}')
      } catch (err) {
        return {}
      }
    }

    const setShareCountStorage = function (store) {
      if (window.localStorage) {
        window.localStorage.setItem('maildevShareCounts', JSON.stringify(store))
      }
    }

    const updateShareCount = function () {
      const key = getActiveFilters().key || $scope.config?.filterKey || ''
      if (!key) {
        $scope.shareCount = 0
        return
      }
      const store = getShareCountStorage()
      $scope.shareCount = store[key] || 0
    }

    const increaseShareCount = function () {
      const key = getActiveFilters().key || $scope.config?.filterKey || ''
      if (!key) return
      const store = getShareCountStorage()
      store[key] = (store[key] || 0) + 1
      setShareCountStorage(store)
      $scope.shareCount = store[key]
    }

    const loadDashboardMetrics = function () {
      const filters = getActiveFilters()
      const query = new URLSearchParams()
      if (filters.key) query.set('u', filters.key)
      else {
        if (filters.from) query.set('from', filters.from)
        if (filters.to) query.set('to', filters.to)
      }
      const url = query.toString() ? 'metrics?' + query.toString() : 'metrics'
      $http({ method: 'GET', url })
        .success(function (data) {
          $scope.dashboardMetrics = data
          $scope.metrics.total = data.inboxCount || 0
          $scope.metrics.unread = data.inboxUnread || 0
          $scope.metrics.read = data.inboxRead || 0
          $scope.unreadItems = $scope.metrics.unread
          Favicon.setUnreadCount($scope.unreadItems)
        })
    }

    const countUnread = function () {
      const loadedUnread = $scope.items.filter(function (email) {
        return !email.read
      }).length
      const hasGlobalMetrics = Number.isFinite($scope.dashboardMetrics.inboxCount)
      if (hasGlobalMetrics) {
        $scope.metrics.total = $scope.dashboardMetrics.inboxCount || 0
        $scope.metrics.unread = $scope.dashboardMetrics.inboxUnread || 0
        $scope.metrics.read = $scope.dashboardMetrics.inboxRead || 0
      } else {
        $scope.metrics.total = $scope.items.length
        $scope.metrics.unread = loadedUnread
        $scope.metrics.read = $scope.metrics.total - $scope.metrics.unread
      }
      $scope.unreadItems = $scope.metrics.unread
      Favicon.setUnreadCount($scope.unreadItems)
    }

    const appendUniqueEmails = function (incomingItems) {
      if (!Array.isArray(incomingItems) || !incomingItems.length) return
      const knownIds = new Set($scope.items.map(function (item) { return item.id }))
      incomingItems.forEach(function (item) {
        if (!knownIds.has(item.id)) $scope.items.push(item)
      })
    }

    const ensureScrollableFill = function () {
      const el = document.querySelector('.sidebar-scrollable-content')
      if (!el) return
      if ($scope.itemsLoading || $scope.loadingMore || !$scope.hasMoreItems) return
      if (el.scrollHeight > el.clientHeight + 32) return
      $scope.loadMoreEmails().then(function () {
        $scope.$evalAsync(ensureScrollableFill)
      })
    }

    const requestEmailPage = function (skipCount, resetList) {
      if ($scope.loadingMore || (!resetList && !$scope.hasMoreItems)) return Promise.resolve()

      const filters = getActiveFilters()
      const pageSize = Number($scope.settings.pageSize) || DEFAULT_EMAILS_PAGE_SIZE
      if (resetList) {
        $scope.itemsLoading = true
      } else {
        $scope.loadingMore = true
      }

      const request = Email.query({
        skip: skipCount,
        limit: pageSize,
        u: filters.key || null,
        from: filters.from || null,
        to: filters.to || null
      })

      return request.$promise
        .then(function (pageItems) {
          const safeItems = Array.isArray(pageItems) ? pageItems : []
          if (resetList) {
            $scope.items = safeItems
          } else {
            appendUniqueEmails(safeItems)
          }
          $scope.nextSkip = skipCount + safeItems.length
          $scope.hasMoreItems = safeItems.length === pageSize
          countUnread()
        })
        .finally(function () {
          $scope.itemsLoading = false
          $scope.loadingMore = false
          window.setTimeout(function () {
            $scope.$evalAsync(ensureScrollableFill)
          }, 0)
        })
    }

    const loadData = function () {
      $scope.items = []
      $scope.nextSkip = 0
      $scope.hasMoreItems = true

      requestEmailPage(0, true).then(function () {
        loadDashboardMetrics()
      })
    }

    $scope.loadMoreEmails = function () {
      return requestEmailPage($scope.nextSkip, false)
    }

    const onEmailListScroll = function (event) {
      if ($scope.itemsLoading || $scope.loadingMore || !$scope.hasMoreItems) return
      const target = event && event.target
      if (!target) return
      const remaining = target.scrollHeight - (target.scrollTop + target.clientHeight)
      if (remaining > 180) return
      $scope.$evalAsync(function () {
        $scope.loadMoreEmails()
      })
    }

    const bindEmailListScroll = function () {
      const el = document.querySelector('.sidebar-scrollable-content')
      if (!el || el.__maildevInfiniteScrollBound) return
      el.addEventListener('scroll', onEmailListScroll, { passive: true })
      el.__maildevInfiniteScrollBound = true
    }

    $rootScope.$on('Refresh', function (e, d) {
      loadData()
    })

    $rootScope.$on('$routeChangeSuccess', function (e, route) {
      if (route.params) {
        $scope.currentItemId = route.params.itemId
      }
      $scope.shareMailboxLink = buildShareUrl()
      updateShareCount()
      loadDashboardMetrics()
      bindEmailListScroll()
    })

    $rootScope.$on('newMail', function (e, newEmail) {
      // update model
      $scope.items.push(newEmail)
      countUnread()
      loadDashboardMetrics()

      // update DOM at most 5 times per second
      if (!refreshTimeout) {
        refreshTimeout = setTimeout(function () {
          refreshTimeout = null
          if ($scope.settings.autoShowEnabled) {
            $location.path('/email/' + newEmail.id)
          }
          $scope.$apply()
        }, 200)
      }

      // show notifications
      if (!notificationTimeout && $scope.settings.notificationsEnabled) {
        notificationTimeout = setTimeout(function () {
          notificationTimeout = null
        }, 2000)
        new window.Notification('InboxLab', { body: newEmail.subject, icon: 'favicon.ico' })
          .addEventListener('click', function () {
            $location.path('/email/' + newEmail.id)
            $scope.$apply()
          })
      }
    })

    $rootScope.$on('deleteMail', function (e, email) {
      if (email.id === 'all') {
        $rootScope.$emit('Refresh')
        $location.path('/')
      } else {
        const idx = $scope.items.reduce(function (p, c, i) {
          if (p !== 0) return p
          return c.id === email.id ? i : 0
        }, 0)

        const nextIdx = $scope.items.length === 1 ? null : idx === 0 ? idx + 1 : idx - 1
        if (nextIdx !== null) {
          $location.path('/email/' + $scope.items[nextIdx].id)
        } else {
          $location.path('/')
        }

        $scope.items.splice(idx, 1)
        countUnread()
        loadDashboardMetrics()
        $scope.$apply()
      }
    })

    $scope.markCurrentAsRead = function () {
      if (!$scope.currentItemId) return
      if (!$scope.items || !$scope.items.length) return

      const filtered = $scope.items.filter(function (e) {
        return e.id === $scope.currentItemId
      })

      if (!filtered || !filtered.length) return

      const currentItem = filtered[0]

      currentItem.read = true

      countUnread()
    }

    $scope.$watch('currentItemId', function (val, oldVal) {
      $scope.markCurrentAsRead()
    }, false)

    $scope.$watch('items', function (val, oldVal) {
      $scope.markCurrentAsRead()
    }, true)

    $scope.$on('$destroy', function () {
      const el = document.querySelector('.sidebar-scrollable-content')
      if (el && el.__maildevInfiniteScrollBound) {
        el.removeEventListener('scroll', onEmailListScroll)
        delete el.__maildevInfiniteScrollBound
      }
    })

    $scope.markReadAll = function () {
      $http({
        method: 'PATCH',
        url: 'email/read-all'
      })
        .success(function (data, status) {
          for (const email of $scope.items) {
            email.read = true
          }
          countUnread()
          loadDashboardMetrics()
        })
        .error(function (data) {
          window.alert('Read all failed: ' + data.error)
        })
    }

    $scope.headerNavStopPropagation = function ($event) {
      $event.stopPropagation()
    }

    $scope.toggleNavMore = function ($event) {
      $event.stopPropagation()
      $scope.navMoreOpen = !$scope.navMoreOpen
    }

    function hideNavMore (e) {
      $scope.$apply(function () {
        $scope.navMoreOpen = false
      })
    }

    function addHideNavMoreHandler (element) {
      angular.element(element)
        .off('click', hideNavMore)
        .on('click', hideNavMore)
    }

    addHideNavMoreHandler(window)

    $scope.toggleAutoShow = function () {
      $scope.settings.autoShowEnabled = !$scope.settings.autoShowEnabled
      saveSettings()
    }

    $scope.updatePageSize = function () {
      const normalized = Number($scope.settings.pageSize)
      $scope.settings.pageSize = EMAILS_PAGE_SIZE_OPTIONS.includes(normalized) ? normalized : DEFAULT_EMAILS_PAGE_SIZE
      saveSettings()
      loadData()
    }

    $scope.refreshList = function () {
      $rootScope.$emit('Refresh')
    }

    $scope.setMailListFilter = function (type) {
      $scope.mailListFilter = type || 'all'
    }

    $scope.filterByReadStatus = function (email) {
      if ($scope.mailListFilter === 'read') return Boolean(email.read)
      if ($scope.mailListFilter === 'unread') return !email.read
      return true
    }

    $scope.generateShareMailboxLink = function () {
      const shareUrl = buildShareUrl()
      if (shareUrl) {
        $scope.shareMailboxLink = shareUrl
        $scope.shareMailboxStatus = $scope.language === 'es' ? 'Enlace generado.' : 'Link generated.'
        return
      }

      const filters = getActiveFilters()
      if (!filters.from && !filters.to && !$scope.config?.filterFrom && !$scope.config?.filterTo) {
        $scope.shareMailboxStatus = $scope.language === 'es' ? 'Agrega filtro From o To para generar enlace.' : 'Add From or To filter to generate a link.'
        return
      }

      const from = filters.from || $scope.config?.filterFrom || ''
      const to = filters.to || $scope.config?.filterTo || ''
      const keyUrl = 'filter-key?from=' + window.encodeURIComponent(from) + '&to=' + window.encodeURIComponent(to)
      $http({ method: 'GET', url: keyUrl })
        .success(function (data) {
          if (!data?.key) {
            $scope.shareMailboxStatus = $scope.language === 'es' ? 'No se pudo generar key.' : 'Unable to generate key.'
            return
          }
          const url = new URL(window.location.href)
          url.searchParams.delete('view')
          url.searchParams.delete('from')
          url.searchParams.delete('to')
          url.searchParams.set('u', data.key)
          $scope.shareMailboxLink = url.toString()
          $scope.shareMailboxStatus = $scope.language === 'es' ? 'Enlace generado.' : 'Link generated.'
        })
        .error(function () {
          $scope.shareMailboxStatus = $scope.language === 'es' ? 'No se pudo generar key.' : 'Unable to generate key.'
        })
    }

    $scope.copyShareMailboxLink = function () {
      if (!$scope.shareMailboxLink) {
        $scope.generateShareMailboxLink()
      }
      if (!$scope.shareMailboxLink) return
      window.navigator.clipboard.writeText($scope.shareMailboxLink)
        .then(function () {
          $scope.$apply(function () {
            $scope.shareMailboxStatus = $scope.language === 'es' ? 'Enlace copiado al portapapeles.' : 'Link copied to clipboard.'
            increaseShareCount()
          })
        })
        .catch(function () {
          $scope.$apply(function () {
            $scope.shareMailboxStatus = $scope.language === 'es' ? 'No se pudo copiar automaticamente.' : 'Unable to copy automatically.'
          })
        })
    }

    $scope.deleteAll = function () {
      let t
      if ($scope.deleteAllSafeguard) {
        $scope.deleteAllSafeguard = false
        t = setTimeout(function () {
          $scope.deleteAllSafeguard = true
          $scope.$apply()
        }, 2000)
        return
      }
      clearTimeout(t)
      $scope.deleteAllSafeguard = true
      Email.delete({ id: 'all' })
    }

    $scope.toggleDarkTheme = function () {
      $scope.settings.darkThemeEnabled = !$scope.settings.darkThemeEnabled
      saveSettings()
    }

    $scope.toggleNotifications = function () {
      if ($scope.notificationsSupported && $scope.settings.notificationsEnabled) {
        $scope.settings.notificationsEnabled = false
        saveSettings()
        return
      }

      window.Notification.requestPermission()
        .then(function (permissions) {
          $scope.settings.notificationsEnabled = permissions === 'granted'
          saveSettings()
        })
        .catch(function () {
          window.alert('Unable to enable web notifications. See console for more information')
        })
    }

    $scope.clearFilter = function () {
      $http({
        method: 'POST',
        url: 'clear-filter'
      })
        .success(function () {
          console.log('Filter cleared')
          window.location.href = '/#/'
        })
    }

    // Initialize the view
    loadData()
    bindEmailListScroll()

    const activeFilters = getActiveFilters()
    const configQuery = new URLSearchParams()
    if (activeFilters.key) configQuery.set('u', activeFilters.key)
    if (activeFilters.from) configQuery.set('from', activeFilters.from)
    if (activeFilters.to) configQuery.set('to', activeFilters.to)
    const configUrl = configQuery.toString() ? 'config?' + configQuery.toString() : 'config'

    $http({ method: 'GET', url: configUrl })
      .success(function (data) {
        $rootScope.config = data
        $scope.config = data
        $scope.shareMailboxLink = buildShareUrl()
        updateShareCount()
        loadDashboardMetrics()
      })
  }
])
