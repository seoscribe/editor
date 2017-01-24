;(function (win, doc) {
  'use strict';
  var _worker;
  var _UI = {
    'root': (doc.documentElement || doc.getElementsByTagName('html')[0]),
    'head': (doc.head || doc.getElementsByTagName('head')[0]),
    'body': (doc.body || doc.getElementsByTagName('body')[0]),
    'keyword_field': doc.getElementById('keyword'),
    'content_field': doc.getElementsByTagName('textarea')[0],
    'word_count': doc.getElementById('word_count'),
    'keyword_density': doc.getElementById('keyword_density'),
    'keyword_headings': doc.getElementById('keyword_headings'),
    'keyword_first_para': doc.getElementById('keyword_first_para'),
    'readability': doc.getElementById('readability_score'),
    'smog_readability': doc.getElementById('smog_score'),
    'related_word_density': doc.getElementById('rel_density'),
    'lsi_word_density': doc.getElementById('lsi_density'),
    'transition_word_density': doc.getElementById('trs_density'),
    'sentences_too_long': doc.getElementById('sntc_warn'),
    'paragraphs_too_long': doc.getElementById('para_warn'),
    'no_headings': doc.getElementById('no_hdngs'),
    'no_links': doc.getElementById('no_links'),
    'no_lists': doc.getElementById('no_lists'),
    'no_images': doc.getElementById('no_imgs'),
    'no_alts': doc.getElementById('no_img_alts'),
    'btn_save': doc.getElementById('save_storage'),
    'btn_export_plain': doc.getElementById('exp_txt'),
    'btn_export_html': doc.getElementById('exp_htm'),
    'btn_toggle_menu': doc.getElementById('btn_menu'),
    'chk_night_mode': doc.getElementById('night_mode')
  };
  var _keyword = _UI.keyword_field.value.trim().toLowerCase();
  win.rel_words = [];
  win.lsi_words = [];
  win.googleLSIWords = googleLSIWords;
  win.bingLSIWords = bingLSIWords;

  initApp();

  function initApp () {
    if (!('Worker' in win)) {
      throw new win.Error('Please use an up-to-date browser');
    }

    _worker = new win.Worker('https://seoscribe.net/assets/js/editor-worker.js');

    if (!('performance' in win)) {
      win.performance = {
        'now': function () { return new win.Date().getTime() }
      };
    }

    if (!('URL' in win) && 'webkitURL' in win) {
      win.URL = win.webkitURL;
    }

    if ('localStorage' in win) {
      if (win.localStorage.getItem('autosaved_kw')) {
        _UI.keyword_field.value = win.localStorage.getItem('autosaved_kw');
      }

      if (win.localStorage.getItem('autosaved_txt')) {
        _UI.content_field.value = win.localStorage.getItem('autosaved_txt');
      }

      if (!win.localStorage.getItem('night_mode')) {
        storeNightMode();

      } else if (win.localStorage.getItem('night_mode') !== 'false') {
        _UI.chk_night_mode.checked = !0;
        setNightMode();

      } else {
        setNightMode();
      }
    }

    if (win.location.protocol === 'https:' && 'serviceWorker' in win.navigator) {
      win.navigator.serviceWorker.register('https://seoscribe.net/editor/sw.js', {
        scope: 'https://seoscribe.net/editor/'
      }).then(function (registration) {
        win.console.info('SW registered [' + registration.scope + ']')
      }).catch(function (err) {
        win.console.warn('SW failed to register [' + err + ']')
      });
    }

    eventWireUp();
    startSEOScribe();
    asyncLoadFonts(['https://fonts.googleapis.com/css?family=Karla:400,700&subset=latin-ext','https://fonts.googleapis.com/css?family=Roboto+Mono:400&subset=latin-ext']);
  }

  function eventWireUp () {
    win.addEventListener('load', loadUI, {passive: true, capture: false, once: true});

    _worker.addEventListener('message', updateUI, {
      passive: true, capture: false, once: false
    });

    _UI.keyword_field.addEventListener('blur', startSEOScribe, {
      passive: true, capture: false, once: false
    });

    _UI.content_field.addEventListener('blur', checkContent, {
      passive: true, capture: false, once: false
    });

    _UI.content_field.addEventListener('input', rebounce(checkContent), {
      passive: true, capture: false, once: false
    });

    _UI.btn_export_plain.addEventListener('click', exportText, {
      passive: true, capture: false, once: false
    });

    _UI.btn_export_html.addEventListener('click', exportText, {
      passive: true, capture: false, once: false
    });

    _UI.btn_toggle_menu.addEventListener('click', toggleMenu, {
      passive: true, capture: false, once: false});

    if ('localStorage' in win) {
      win.addEventListener('unload', saveToStorage, {
        passive: true, capture: false, once: true
      });

      _UI.btn_save.addEventListener('click', saveToStorage, {
        passive: true, capture: false, once: false
      });

      _UI.chk_night_mode.addEventListener('click', storeNightMode, {
        passive: true, capture: false, once: false
      });
    }
  }

  function startSEOScribe () {
    if (_keyword !== _UI.keyword_field.value.trim().toLowerCase()) {
      _keyword = _UI.keyword_field.value.trim().toLowerCase();
    }

    win.rel_words = [];
    win.lsi_words = [];
    
    if (!_keyword) {
      return;
    }

    if ('localStorage' in win) {
      win.localStorage.setItem('autosaved_kw', _keyword);
    }

    getRelatedWords(['//api.datamuse.com/words?ml=']);
    getLSIWords(['//suggestqueries.google.com/complete/search?client=youtube&hl=en&jsonp=googleLSIWords&q=','//api.bing.com/osjson.aspx?JsonType=callback&JsonCallback=bingLSIWords&query=']);
    checkContent();
  }

  function checkContent () {
    var _txt_to_process = _UI.content_field.value;
    var _has_html = !!_txt_to_process && _txt_to_process.match(/<\/?[\w\s="/.':;#-\/\?]+>+[\/?[\w\s="/.':;#-\/\?]+<\/?[\w\s="/.':;#-\/\?]+>/gi) ? true : false;

    if ('localStorage' in win ) {
      win.localStorage.setItem('autosaved_txt', _txt_to_process);
    }

    if (!_keyword && !_txt_to_process) {
      return;

    } else if (!_has_html) {
      _UI.root.setAttribute('data-has-html', 'false');

    } else {
      _UI.root.setAttribute('data-has-html', 'true');
    }

    _worker.postMessage({
      'keyword': _keyword,
      'plain': (!!_has_html ? parseHTML(_txt_to_process) : _txt_to_process),
      'rel_wrds': win.rel_words,
      'lsi_wrds': win.lsi_words
    });

    sweepJSONP();
  }

  function parseHTML (markup) {
    var _prsr = new win.DOMParser();
    var _doc = _prsr.parseFromString(['<!doctype html><html><head><meta charset="utf-8"></head><body>', markup, '</body></html>'].join(''),'text/html');

    updateUI({
      'html_data': {
        'headings': _doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,header'),
        'links': _doc.querySelectorAll('a[href]').length,
        'lists': _doc.querySelectorAll('ul li,ol li,dl dd').length,
        'images': _doc.querySelectorAll('img[src]').length,
        'no_alts': _doc.querySelectorAll('img:not([alt])').length
      }
    });

    return _doc.body.textContent;
  }

  function loadUI () {
    _UI.root.setAttribute('data-font-loaded', 'true');
  }

  function updateUI (e) {
    if (typeof e !== 'object' || !e) {
      return;
    }

    if (e.type === 'message' && !!e.data) {
      updatePlain(e.data);

    } else if (!!e.html_data && typeof e.html_data === 'object') {
      updateHTML(e.html_data);
    }
  }

  function updatePlain (results) {
    _UI.word_count.textContent              = results.word_count;
    _UI.keyword_density.textContent         = results.keyword_density + '%';
    _UI.related_word_density.textContent    = results.related_word_density + '%';
    _UI.lsi_word_density.textContent        = results.lsi_word_density + '%';
    _UI.transition_word_density.textContent = results.transition_word_density + '%';
    _UI.keyword_first_para.textContent      = results.keyword_in_first_para;
    _UI.readability.textContent             = results.readability;
    _UI.smog_readability.textContent        = results.smog_readability;

    results.smog_readability > 0 ?
      _UI.smog_readability.parentNode.removeAttribute('hidden') :
        _UI.smog_readability.parentNode.setAttribute('hidden', '');

    results.sentences_too_long ?
      _UI.sentences_too_long.removeAttribute('hidden') :
        _UI.sentences_too_long.setAttribute('hidden', '');

    results.paragraphs_too_long ?
      _UI.paragraphs_too_long.removeAttribute('hidden') :
        _UI.paragraphs_too_long.setAttribute('hidden', '');

    adjustWordCountColor(results.word_count, _UI.word_count);
    adjustDensityColor(results.keyword_density, _UI.keyword_density);
    adjustDensityColor(results.related_word_density, _UI.related_word_density);
    adjustDensityColor(results.lsi_word_density, _UI.lsi_word_density);
  }

  function updateHTML (results) {
    var _hc = 0;
    var h = 0, j = 0, m = 0;

    results.headings.length < 1 ?
      _UI.no_headings.removeAttribute('hidden') :
        _UI.no_headings.setAttribute('hidden', '');

    results.links < 1 ?
      _UI.no_links.removeAttribute('hidden') :
        _UI.no_links.setAttribute('hidden', '');

    results.lists < 1 ?
      _UI.no_lists.removeAttribute('hidden') :
        _UI.no_lists.setAttribute('hidden', '');

    results.images < 1 ?
      _UI.no_images.removeAttribute('hidden') :
        _UI.no_images.setAttribute('hidden', '');

    results.no_alts > 0 ?
      _UI.no_alts.removeAttribute('hidden') :
        _UI.no_alts.setAttribute('hidden', '');

    for (; h < results.headings.length; ++h) {
      if (matchString(results.headings[h].textContent, _keyword, false) > 0) {
        _hc++;
      } else {
        for (; j < win.rel_words.length; ++j) {
          if (matchString(results.headings[h].textContent, win.rel_words[j], true) > 0) {
            _hc++;
            break;
          } else {
            for (; m < win.lsi_words.length; ++m) {
              if (matchString(results.headings[h].textContent, win.lsi_words[m], true) > 0) {
                _hc++;
                break;
              }
            }
          }
        }
      }
    }

    _UI.keyword_headings.textContent = _hc === results.headings.length && _hc > 0 ? 'Yes' : 'No';
  }

  function adjustDensityColor (val, el) {
    el.style.width = val + '%';
    if (val >= 15 && val > 14) {
      el.style.borderColor = 'rgba(244,67,54,.7)';
    } else if (val < 14 && val >= 6 && val > 0) {
      el.style.borderColor = 'rgba(255,138,34,.7)';
    } else if (val <= 5 && val >= 4 && val > 0) {
      el.style.borderColor = 'rgba(255,204,0,.7)';
    } else if (val < 4 && val > 0) {
      el.style.borderColor = 'rgba(154,205,50,.7)';
    } else {
      el.style.borderColor = 'rgba(244,67,54,.7)';
    }
  }

  function adjustWordCountColor (val, el) {
    el.style.width = val <= 1000 ? val / 10 + '%' : '100%';
    if (val > 399) {
      el.style.borderColor = 'rgba(154,205,50,.7)';
    } else if (val <= 399 && val > 299) {
      el.style.borderColor = 'rgba(255,204,0,.7)';
    } else if (val <= 299 && val > 199) {
      el.style.borderColor = 'rgba(255,138,34,.7)';
    } else if (val <= 199) {
      el.style.borderColor = 'rgba(244,67,54,.7)';
    } else {
      el.style.borderColor = 'rgba(244,67,54,.7)';
    }
  }

  function matchString (string, to_match, exact) {
    var _is_phrase;
    var _rgx;
    var _idx;

    switch (true) {
      case !!(typeof string !== 'string'):
      case !!(typeof to_match !== 'string'):
      case !(string):
      case !(to_match):
        return 0;
    }

    _is_phrase = !!(to_match.split(' ').length > 1);

    _rgx = ((typeof exact !== 'undefined' && !!exact) || !!_is_phrase) ?
      to_match :
        to_match + '|' + to_match + 's|' + to_match + 'i?es';

    _idx = string.match(new win.RegExp('\\b(' + _rgx + ')\\b', 'gi'));

    if (_idx && _idx.length > 0) {
      return _idx.length;
    }

    return 0;
  }


  function clean (word) {
    if (typeof word !== 'string') {
      return word;
    }
    return word.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,'').toLowerCase();
  }

  function generateQueryString () {
    var _qs = '';

    if (!_keyword) {
      return '';
    }

    if (_keyword.split(' ').length > 1) {
      _qs = _keyword.split(' ').map(function (word) {
        return win.encodeURIComponent(clean(word));
      }).join('+');
    } else {
      _qs = _keyword;
    }

    return _qs;
  }

  function getRelatedWords (uris) {
    uris.forEach(function (uri) {
      var _querystring = generateQueryString();
      var _xhr = new win.XMLHttpRequest();
      _xhr.open('GET', win.location.protocol + uri + _querystring, true);
      _xhr.responseType = 'json';
      _xhr.onreadystatechange = function () {
        if (_xhr.readyState === 4 && _xhr.status >= 200 && _xhr.status < 300) {
          win.rel_words = win.rel_words.concat(
            _xhr.response.map(function (datum) {
              return datum.word;
            })
          );
        }
      };
      _xhr.onerror = _xhr.onabort = _xhr.ontimeout = function () {
        win.console.error('XHR failed or cancelled: ' + _xhr.status);
      };
      _xhr.send(null);
    });
  }

  function getLSIWords (uris) {
    uris.forEach(function(uri){
      var _querystring = generateQueryString();
      var _script = doc.createElement('script');
      _script.async = !0;
      _script.src = win.location.protocol + uri + _querystring;
      _script.setAttribute('data-lsi', 'true');
      doc.body.appendChild(_script);
    });
  }

  function googleLSIWords (resp) {
    win.lsi_words = win.lsi_words.concat(
      resp[1].map(function (datum) {
        return datum[0];
      })
    ).filter(function(word, idx, arr) {
      return idx === arr.indexOf(word);
    });
  }

  function bingLSIWords (resp) {
    win.lsi_words = win.lsi_words.concat(resp[1]).filter(function(word, idx, arr) {
      return idx === arr.indexOf(word);
    });
  }

  function saveToStorage (e) {
    var _evt = (e.target || this);
    if ('localStorage' in win) {
      win.localStorage.setItem('autosaved_txt', _UI.content_field.value);
      win.localStorage.setItem('autosaved_kw', _keyword);
      if (typeof _evt !== 'undefined' && 'setAttribute' in _evt) {
        _evt.textContent = 'Saved';
        _evt.setAttribute('disabled', '');
        win.setTimeout(function () {
          _evt.textContent = 'Save';
          _evt.removeAttribute('disabled');
        }, 3e3);
      }
    }
  }

  function exportText (e) {
    var _evt = (e.target || this);
    var _txt_type = 'text/' + (_evt.getAttribute('data-txt-type') || 'plain');
    var _dl_link = doc.createElement('a');

    var _blob = _txt_type === 'text/html' ?
      ['<!doctype html><html><head><meta charset="utf-8"></head><body>', _UI.content_field.value, '</body></html>'].join('') :
        _UI.content_field.value;

    _evt.setAttribute('disabled', '');

    win.setTimeout(function () {
      _evt.removeAttribute('disabled');
    }, 2e3);

    _dl_link.href = createBlob(_txt_type, _blob);
    _dl_link.textContent = 'Download';
    _dl_link.style.display = 'none';
    _dl_link.addEventListener('click', removeThisEl, {
      passive: true, capture: false, once: true
    });

    if ('download' in _dl_link) {
      _dl_link.download = [(_keyword || 'untitled'), '-', (new win.Date().toDateString().split(' ').join('-')), (_txt_type === 'text/html' ? '.html' : '.txt')].join('');
    } else {
      _dl_link.target = '_blank';
      _dl_link.rel = 'noreferrer noopener nofollow';
    }
    _UI.body.appendChild(_dl_link);
    _dl_link.click();
  }

  function removeThisEl (e) {
    var _evt = (e.target || this);
    _evt.removeEventListener('click', removeThisEl, {
      passive: true, capture: false, once: true
    });
    _UI.body.removeChild(_evt);
  }

  function createBlob (mimetype, data) {
    if ('createObjectURL' in win.URL) {
      return win.URL.createObjectURL(new win.Blob([data], { type: mimetype }));
    }
    return 'data:' + mimetype + ',' + win.encodeURIComponent(data);
  }

  function exportRTF () {
  }

  function exportWord () {
    //var doc = new DOCXjs();
    //doc.text('');
  }

  function exportPDF () {
    //var doc = new jsPDF();
    //doc.text('');
  }

  function storeNightMode () {
    if ('localStorage' in win) {
      win.localStorage.setItem('night_mode', _UI.chk_night_mode.checked);
      setNightMode();
    }
  }

  function setNightMode () {
    if ('localStorage' in win) {
      _UI.root.setAttribute('data-night-mode', win.localStorage.getItem('night_mode') !== 'true' ? 'off' : 'on');
    }
  }

  function sweepJSONP () {
    var _scripts = doc.querySelectorAll('[data-lsi]');
    var i = _scripts.length;
    var j = 0;
    for (; j < i; ++j) {
      _scripts[j].parentNode.removeChild(_scripts[j]);
    }
  }

  function toggleMenu () {
    _UI.root.getAttribute('data-menu-open') === 'true'
      ? _UI.root.setAttribute('data-menu-open','false')
        : _UI.root.setAttribute('data-menu-open','true');
  }

  function asyncLoadFonts (urls) {
    urls.forEach(function (url) {
      var _font;
      _font = doc.createElement('link');
      _font.href = url;
      _font.rel = 'stylesheet';
      _UI.head.appendChild(_font);
    });
  }

  function rebounce (func) {
    var scheduled, context, args, i, j;
    return function () {
      context = this;
      args = [];
      i = arguments.length;
      j = 0;

      for (; j < i; ++j) {
        args[j] = arguments[j];
      }

      if (!!scheduled) {
        win.cancelAnimationFrame(scheduled);
      }

      scheduled = win.requestAnimationFrame(function () {
        func.apply(context, args);
        scheduled = null;
      });
    }
  }
})(window, window.document);
