/* global angular, app, prompt */

/**
 * Email item Controller -- The UI for the email pane
 */

app.controller('ItemCtrl', [
  '$scope',
  '$rootScope',
  '$routeParams',
  '$location',
  'Email',
  '$http',
  '$cookies',
  function (
    $scope,
    $rootScope,
    $routeParams,
    $location,
    Email,
    $http,
    $cookies
  ) {
    function tr (key, es, en) {
      if (typeof $scope.t === 'function') return $scope.t(key)
      return ($scope.language === 'en' ? en : es)
    }
    // Get the item data by route parameter
    const getItem = function () {
      Email.get(
        { id: $routeParams.itemId },
        function (email) {
          $scope.item = new Email(email)

          if ($scope.item.html) {
            $scope.item.iframeUrl = 'email/' + $scope.item.id + '/html'
            prepIframe()
            $scope.panelVisibility = 'html'
          } else {
            $scope.htmlView = 'disabled'
            $scope.panelVisibility = 'plain'
          }
        },
        function () {
          console.error('404: Email not found')
          $location.path('/')
        }
      )
    }

    // Get email source
    const getSource = function () {
      if (typeof $scope.rawEmail === 'undefined') {
        $scope.rawEmail = 'email/' + $scope.item.id + '/source'
      }
    }

    // Prepares the iframe for interaction
    const prepIframe = function () {
      // Wait for iframe to load
      setTimeout(function () {
        const [iframe] = document.getElementsByTagName('iframe')
        const [head] = iframe.contentDocument.getElementsByTagName('head')
        const baseEl = iframe.contentDocument.createElement('base')

        // Append <base target="_blank" /> to <head> in the iframe so all links open in new window
        baseEl.setAttribute('target', '_blank')

        if (head) head.appendChild(baseEl)

        replaceMediaQueries(iframe)
        fixIframeHeight(iframe)

        addHideDropdownHandler(
          iframe.contentDocument.getElementsByTagName('body')[0]
        )
      }, 500)
    }

    // Updates the iframe height so it matches it's content
    // This prevents the iframe from having scrollbars
    const fixIframeHeight = function (iframe) {
      const body = iframe.contentDocument.getElementsByTagName('body')[0]
      const newHeight = body.scrollHeight

      iframe.height = newHeight
    }

    // Updates all media query rules to use 'width' instead of device width
    const replaceMediaQueries = function (iframe) {
      angular.forEach(
        iframe.contentDocument.styleSheets,
        function (styleSheet) {
          angular.forEach(styleSheet.cssRules, function (rule) {
            if (rule.media && rule.media.mediaText) {
              // TODO -- Add future warning if email doesn't use '[max|min]-device-width' media queries
              rule.media.mediaText = rule.media.mediaText.replace(
                'device-width',
                'width'
              )
            }
          })
        }
      )
    }

    // NOTE: This is kind of a hack to get these dropdowns working. Should be revisited in the future
    // Toggle a dropdown open/closed by toggling a class on the trigger itself
    $scope.toggleDropdown = function ($event, dropdownName) {
      $event.stopPropagation()
      $scope.dropdownOpen =
        dropdownName === $scope.dropdownOpen ? '' : dropdownName
    }

    function hideDropdown (e) {
      $scope.$apply(function () {
        $scope.dropdownOpen = ''
      })
    }

    function addHideDropdownHandler (element) {
      angular
        .element(element)
        .off('click', hideDropdown)
        .on('click', hideDropdown)
    }

    addHideDropdownHandler(window)

    function validateEmail (email) {
      const re =
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      return re.test(email)
    }

    // Toggle what format is viewable
    $scope.show = function (type) {
      if ((type === 'html' || type === 'attachments') && !$scope.item[type]) {
        return
      }
      if (type === 'source') getSource()

      $scope.panelVisibility = type
    }

    // Sends a DELETE request to the server
    $scope.delete = function (item) {
      Email.delete({ id: item.id })
    }

    // Updates iframe to have a width of newSize, i.e. '320px'
    $scope.resize = function (newSize) {
      const [iframe] = document.getElementsByTagName('iframe')
      iframe.style.width = newSize || '100%'
      fixIframeHeight()
      $scope.iframeSize = newSize
    }

    // Relay email to
    $scope.relayTo = function (item) {
      const lastRelayTo = $cookies.relayTo

      const relayTo = prompt(
        'Please enter email address to relay',
        lastRelayTo
      )

      if (relayTo) {
        if (validateEmail(relayTo)) {
          $scope.relay(item, relayTo)
          $cookies.relayTo = relayTo
        } else {
          window.alert(tr('invalidEmail', 'El correo especificado no es valido.', 'The specified email address is not correct.'))
        }
      }
    }

    // Relay email
    $scope.relay = function (item, relayTo) {
      if (!$rootScope.config.isOutgoingEnabled) {
        window.alert(
          tr(
            'relayNotConfigured',
            'La funcion de reenvio no esta configurada.\nEjecuta maildev --help para mas informacion.',
            'Relay feature has not been configured.\nRun maildev --help for configuration info.'
          )
        )
        return
      }

      if (
        window.confirm(
          tr(
            'relayConfirm',
            'Seguro que deseas reenviar el correo a ',
            'Are you sure you want to REALLY SEND email to '
          ) +
            (relayTo ||
              item.to
                .map(function (to) {
                  return to.address
                })
                .join()) +
            tr('throughHost', ' a traves de ', ' through ') +
            $rootScope.config.outgoingHost +
            '?'
        )
      ) {
        $http({
          method: 'POST',
          url: 'email/' + item.id + '/relay' + (relayTo ? '/' + relayTo : '')
        })
          .success(function (data, status) {
            console.log('Relay result: ', data, status)
            window.alert(tr('relaySuccess', 'Reenvio exitoso.', 'Relay successful'))
          })
          .error(function (data) {
            window.alert(tr('relayFailed', 'Reenvio fallido: ', 'Relay failed: ') + data.error)
          })
      }
    }

    function getAttachmentName (attachment) {
      return (
        attachment.generatedFileName ||
        attachment.fileName ||
        attachment.filename ||
        ''
      )
    }

    function getAttachmentType (attachment) {
      return (attachment.contentType || attachment.mimeType || '').toLowerCase()
    }

    $scope.getAttachmentUrl = function (attachment) {
      if (!$scope.item || !$scope.item.id || !attachment) return ''
      return (
        'email/' +
        $scope.item.id +
        '/attachment/' +
        window.encodeURIComponent(getAttachmentName(attachment))
      )
    }

    $scope.isImageAttachment = function (attachment) {
      const contentType = getAttachmentType(attachment)
      const name = getAttachmentName(attachment).toLowerCase()
      return (
        contentType.indexOf('image/') === 0 ||
        /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
      )
    }

    $scope.isPdfAttachment = function (attachment) {
      const contentType = getAttachmentType(attachment)
      const name = getAttachmentName(attachment).toLowerCase()
      return contentType === 'application/pdf' || /\.pdf$/i.test(name)
    }

    // Initialize the view by getting the email
    getItem()
  }
])
