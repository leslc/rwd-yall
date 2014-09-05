(function(window, $) {
  'use strict';

  /*
   * Global api.
   */
  var yall = window.yall = {
    get: function() {
      return _instance;
    },
    //Main entry point.
    init: function(options) {
      if (!_instance) {

        _instance = new Yall(options);

        // show images on document ready
        // if hidden images aren't shown initially on viewport, DOM wasn't really ready.  You can either 1) set pollInterval, 2) retrigger on window.load in your code
        $(document).ready(function () {
          _attachEvents();
          _instance.refresh();
        });

      } else if (_instance && options) {
        _instance.setOptions(options);
      }

      return _instance;
    },
    VERSION: '0.1'
  };

  // GLOBAL SCOPE
  var _instance    // Singleton
    // nodes
    , _$nodes
    , _hasNodesLeft = false
    // state
    , _winAttrs = {}
    , _showImmediately = false
    , _timeoutId = null
    // options
    , _threshY
    , _threshX
    , _urlFormatter
    , _forceWindow // for testing, object to simulate window attributes
    , _debug
    , _pollInterval
    // helpers
    , $w = $(window);

  // Handlers
  var _registeredHandlers = {

    'img' : {
      'filter': 'img[data-src].lazy'
      ,'fn': function (elem) {
        var $elem = $(elem)
          , source = $elem.attr('data-src') || ''
          , sizesAvail = $elem.attr('data-sizes') || '';

        // if data-sizes specified, look for the appropriate size.  (If not found, should return '' to not change the image
        if (source && sizesAvail) {
          source = _getImage(source, sizesAvail);
        }

        if (source) {
          var newSource = _urlFormatter ? _urlFormatter(source) : source; // need to compare with Akamized URL
          if ( newSource !== $elem.attr('src') ) {
            $elem.attr('src', newSource);
            $elem.error(function() {$(this).after('<span style="color:red;">MISSING IMAGE "' + newSource + '"</span>'); });
            $elem.load(function() {$(this).trigger('yall-loaded'); });
            if (_debug) console.log('yall.js: Image ' + newSource);

          } else {
            // catches the case where an image doesn't have a src for one or more breakpoints and was previously hidden
            $elem.show().data('yall-nosource', false);
          }
        } else {
          $elem.hide().data('yall-nosource', true);
        }
      }
    }

    ,'div' : {
      'filter': 'div[data-src].lazy'
      ,'fn': function(elem) {
        var $elem = $(elem)
          , source = $elem.attr('data-src') || ''
          , sizesAvail = $elem.attr('data-sizes') || ''
          , style = $elem.attr('data-style') || '';

        // if data-sizes specified, look for the appropriate size.  (If not found, should return '' to not change the image
        if (source && sizesAvail) {
          source = _getImage(source, sizesAvail);
        }

        if (source) {
          var newSource = _urlFormatter ? _urlFormatter(source) : source; // need to compare with Akamized URL
          var oldSource = $elem.css('background-image');
          if ( !oldSource.match(newSource) ) { // bg-img urls get full paths in style tags, which makes them hard to compare with ===
            _removePreviousStyle($elem);

            // set new styles
            var cssAttr = _getStyle(style);
            $.extend(cssAttr, {'background-image': 'url(' + newSource + ')'} );
            _setStyle($elem, cssAttr);

            // throw an error if image fails to load
            $elem.error(function() {$(this).after('<span style="color:red;">MISSING IMAGE "' + source + '"</span>'); });
            if (_debug) console.log('yall.js: Background ' + source + ' with attributes ' + JSON.stringify(cssAttr));
          }
        } else {
          _removePreviousStyle($elem);
        }
      }
    }

    ,'iframe' : {
      'filter': 'iframe[data-src].lazy'
      ,'fn': function (elem) {
        var $elem = $(elem)
          , source = $elem.attr('data-src') || '';

        if (source && source !== $elem.attr('src')) {
          $elem.attr('src', source);
          if (_debug) console.log('yall.js: Iframe ' + source);
        }
      }
    }
  };

  /*
    Array of available image sizes.  Evaluated in order listed and the file suffix is returned for the first match
  */
  var _sizePriorityMatrix = [
    {
      type: 'svg'
      ,condition: function () { return !!window.SVGSVGElement; } // dependency-free, *synchronous* check for SVG support
      ,imgSuffix: ''
      ,imgExtension: 'svg'
    }
    ,{
      type: 'ret-lo'
      ,condition: function () { return (_winAttrs.retina && _winAttrs.win_width < 768); }
      ,imgSuffix: '-ret-lo'
    }
    ,{
      type: 'ret-hi'
      ,condition: function () { return (_winAttrs.retina && _winAttrs.win_width >= 768); }
      ,imgSuffix: '-ret-hi'
    }
    ,{
      type: 'lo'
      ,condition: function () { return (_winAttrs.win_width < 768); }
      ,imgSuffix: '-lo'
    }
    ,{
      type: 'hi'
      ,condition: function () { return (_winAttrs.win_width >= 768); }
      ,imgSuffix: '-hi'
    }
  ];

  /**
   * Constructor.
   */
  function Yall(options) {
    // setting options
    this.setOptions(options);

    // setting instance
    _instance = this;

    return _instance;
  }

  /**
   * Prototype functions - available to users off the instance
   */
  Yall.prototype.setOptions = function(options) {
    options = (options || {});

    _threshY = options.threshY || 0;
    _threshX = options.threshX || 0;
    _urlFormatter = options.urlFormatter;
    _forceWindow = options.forceWindow;
    _debug = (window.console && options.debug) || false;
    _pollInterval = options.pollInterval || 0;

    _showImmediately = options.showImmediately === true;
  };

  Yall.prototype.attach = function(handler) {
    $.extend(_registeredHandlers, handler);
    return _instance;
  };

  Yall.prototype.trigger = function (recalculate) {
    recalculate = recalculate === true; // default is false.  Recalculate src of images and window X/Y thresholds

    // clear timeout if it exists to pause the polling if scroll/resize events are causing "trigger" to run
    if (_timeoutId) {
      window.clearTimeout(_timeoutId);
      _timeoutId = null;
    }

    if (recalculate) {
      _$nodes.data('loaded', false);
      _hasNodesLeft = (_$nodes.length > 0);
    }
    if (!_hasNodesLeft) {
      return;
    }

    // set window height/width/retina attributes
    _setWindowAttrs(recalculate); // calcThreshold = true if recalculate

    var existsNodeNotVisible = false
        // window dimensions
      , wtop = _winAttrs.win_top
      , wbot = wtop + _winAttrs.win_height
      , wleft = _winAttrs.win_left
      , wright = wleft + _winAttrs.win_width
      , threshY = _winAttrs.calcThreshY
      , threshX = _winAttrs.calcThreshX;

    _$nodes.filter(function() {
      if($(this).data('loaded') === true) {
        return false;
      }
      if (_showImmediately) {
        return true;
      }

      var $e = $(this)
        // element dimensions
        , etop = $e.offset().top
        , ebot = etop + $e.height()
        , eleft = $e.offset().left
        , eright = eleft + $e.width()

      var visibleVertical = ebot >= wtop - threshY && etop <= wbot + threshY;
      var visibleHorizontal = eright >= wleft - threshX && eleft <= wright + threshX;
      var inViewport = visibleVertical && visibleHorizontal;
      var noPreviousSource = ($e.data('yall-nosource') === true);
      var hiddenByCSS = ($e.is(':hidden') || $e.css('visibility') === 'hidden'); // :hidden checks for display:none and visibility must be checked via css property
      var attemptReveal = inViewport && (noPreviousSource || !hiddenByCSS);

      // set indicator node was encountered that isn't visible yet.  Once true, don't reset
      if (!existsNodeNotVisible && !attemptReveal) {
        existsNodeNotVisible = true;
      }
      return attemptReveal;

    }).data('loaded',true).trigger('yall-show');

    _hasNodesLeft = existsNodeNotVisible;

    // set up polling again
    if (_hasNodesLeft && _pollInterval > 0) {
      _timeoutId = window.setTimeout(_instance.trigger, _pollInterval);
    }

    if (_debug && !_hasNodesLeft) {
      console.log('yall.js: All nodes revealed.');
    }
  };

  Yall.prototype.refresh = function(elements) {
    _collectNodes(); // sets global nodes variable
    _attachHandlers(); // attaches handlers to nodes
    this.trigger(true); // initial trigger needs to recalculate the X/Y threshold

    return _instance;
  };

  // helper functions (not necessary for initialization)
  var _collectNodes = function() {
    var filters = $.map(_registeredHandlers, function (handler, key) {
      return handler.filter;
    });
    _$nodes = $(filters.join(','));
    _hasNodesLeft = (_$nodes.length > 0);
  };

  var _attachHandlers = function() {
    // attach handlers to nodes (virtually, not in the DOM)
    $.each(_registeredHandlers, function(key, handler) {
      _$nodes.filter(handler.filter)
        .data({type: key, fn: handler.fn, loaded: false});
    });

    // add triggers for 'yall-show' event
    _$nodes.on('yall-show', function() {
      var handlerFunction = $(this).data('fn');
      if (typeof(handlerFunction) === "function") {
        handlerFunction.call(_instance, this);
      } else {
        $(this).off('yall-show').after('<span style="color:red;">MISSING HANDLER FOR THIS ELEMENT (Did you forget data-src and data-sizes?)</span>');
      }
    });

  };

  var _attachEvents = function () {
    var throttledResize = _throttle(function () {
      _instance.trigger(true);
    }, 100);

    // window scroll event - no need to attach if all images will be shown initially, since the width won't change to influence images loaded
    if (!_showImmediately) {
      $w.scroll(function () {
        _instance.trigger(false);
      });
    }

    // window resize event
    $w.resize(throttledResize);
  };


  var _setWindowAttrs = function(calcThresh) {

    _winAttrs = {
      win_top: $w.scrollTop()
      , win_left: $w.scrollLeft()
      , win_width: $w.width()
      , win_height: $w.height()
      , retina: window.devicePixelRatio > 1.0
      , calcThreshY: (calcThresh === true && Math.ceil(_threshY) === 1) ? $w.height() * _threshY : (_winAttrs.calcThreshY || _threshY)  // for thresholds: >0 and <=1 is considered percentage
      , calcThreshX: (calcThresh === true && Math.ceil(_threshX) === 1) ? $w.width() * _threshX : (_winAttrs.calcThreshX || _threshX) // for thresholds: >0 and <=1 is considered percentage
    };
    // for testing, if forceWindow is simulating window attributes
    if (_forceWindow) {
      $.extend(_winAttrs, _forceWindow);
    }
    // uncomment to see window attributes
    // if (_debug) console.log('yall.js: _winAttrs = ' + JSON.stringify(_winAttrs));
  };

  var _throttle = function (func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : new Date();
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  var _getImage = function (baseImage, sizesAvail) {
    var sizeArr = _splitStringTrimArray(sizesAvail, ',')    // make array and trim each array element, e.g. "lo, hi" --> ["lo", "hi"]
      , dotIndex = baseImage.lastIndexOf('.')
      , name = baseImage.substring(0, dotIndex);

    // find the appropriate suffix, e.g. '-lo', '-hi'
    var suffix = _getNameComponent('imgSuffix', sizeArr);
    var newExtension = _getNameComponent('imgExtension', sizeArr);

    var ext = newExtension || baseImage.substring(dotIndex+1); // check if the extension is different than the original file

    return (suffix || newExtension) ? (name + suffix + '.' + ext) : '';
  };

  var _getNameComponent = function (nameComponent, sizeArr) {
    for (var i = 0; i < _sizePriorityMatrix.length; i++) {
      var currentSize = _sizePriorityMatrix[i];
      if ($.inArray(currentSize.type, sizeArr) == -1) {
        continue;
      }
      if (currentSize.condition()) {
        return currentSize[nameComponent];
      }
    }
    return null;
  };

  var _splitStringTrimArray = function (s, separator) {
    return $.map(s.split(separator), function(v, i) {return $.trim(v); });
  };

  /*
    Function: _getStyle
    Convert "style" string to a hash object of css properties to be applied.
  */
  var _getStyle = function (style) {
    var cssObj = {};

    // Make into hash object css string attributes
    // For example:  "lo={height:50px; width:50px}, hi = {height:100px; width:100px;}"
    // Becomes:  {"lo": "{height:50px; width:50px}, "hi": "{height:100px; width:100px}"}
    var sizesArr = _splitStringTrimArray(style, ',');      // creates trimmed array ["lo={...}", "hi={...}", ...]
    var sizesObj = {};
    $.each(sizesArr, function (key, size) {
      var arr = _splitStringTrimArray(size, '=');   // creates trimmed array ["lo", "{...}"]
      sizesObj[arr[0]] = arr[1];
    });

    for (var i = 0; i < _sizePriorityMatrix.length; i++) {
      var currentSize = _sizePriorityMatrix[i];
      var cssAttributes = sizesObj[currentSize.type];
      if (cssAttributes === undefined || !currentSize.condition()) {
        continue;
      }

      // convert to real JSON object, e.g. {height:50px; width:50px; background-position:top center;} --> {"height":"50px", "width":"50px", "background-position":"top center"}
      // this is fragile and will break for perhaps certain CSS specified that doesn't fit the format
      var attribs = _splitStringTrimArray(cssAttributes.replace('(', '').replace(')', ''), ';');    // creates trimmed array ["height:50px;", "width:50px", ...]
      $.each(attribs, function (key, attr) {
        var stylesArr = _splitStringTrimArray(attr, ':');    // creates trimmed array ["height", "50px"]
        if (stylesArr.length === 2) {
          cssObj[stylesArr[0]] = stylesArr[1];
        }
      });
    }
    return cssObj;
  };

  var _setStyle = function($elem, cssAttr) {
    $elem.css(cssAttr).data({'yallStyles': cssAttr});
  }

  var _removePreviousStyle = function($elem) {
    var previousStyles = $elem.data('yallStyles');
    if (previousStyles) {
      $.each(previousStyles, function (key, value) {
        $elem.css(key, '');
      });
    }
  }

}(window, jQuery));


// BELOW - THIS WOULD BE MOVED TO A SEPARATE FILE LATER

// init - no polling interval
// var allYall = yall.init({debug: true, threshY: 250, threshX: 0.2, urlFormatter: window.Url ? window.Url.getFullUrl : undefined});

// init - with polling interval every 2 seconds
var allYall = yall.init({debug: true, threshY: 250, threshX: 0.2, pollInterval: 2000, urlFormatter: window.Url ? window.Url.getFullUrl : undefined});

// init - to test show all lazy load items immediately
// var allYall = yall.init({debug: true, threshY: 250, threshX: 0.2, showImmediately: true, urlFormatter: window.Url ? window.Url.getFullUrl : undefined});
