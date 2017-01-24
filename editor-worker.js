'use strict';

// listen for the postMessage from the text editor
// no need for a dispatcher, only one event to listen for
self.addEventListener('message', respondWithData);

// respond to postMessage by checking event obj for message data
// and returning the results of our analyses if we get the green light
function respondWithData (e) {
  if (typeof e !== 'undefined' && !!e.data) {
    return self.postMessage(analyseText(e.data.keyword, e.data.plain, e.data.rel_wrds, e.data.lsi_wrds));
  }
}

// we retrieved the keyword, the full plain text, the related words and LSI words (at the time of writing)
// now we pass these in as parameters to our analysis function
// returns obj or undefined
function analyseText (keyword, plain, rel_wrds, lsi_wrds) {
  var _wc = 0;         // total word count
  var _kc = 0;         // total keyword count
  var _rc = 0;         // total related word count
  var _lc = 0;         // total LSI word count
  var _rdblty = 0;     // readability score (flesch-kincaid)
  var _smog = 0;       // readability score (SMOG: only valid for 30+ sentences)
  var _wrds = [];      // all words
  var _paras = [];     // all paragraphs
  var _sntcs = [];     // all sentences
  var _psv_v = [];     // all instances of passive voice (approximate)
  var _prd_lc = [];    // all instances of a period followed by a lowercase character, indicating a mistake
  var _all_uc = [];    // all instances of ALL CAPS text, typically not found in quality articles
  var _sntc_data = []; // prepped to hold return values of sentence analysis
  var _para_data = []; // prepped to hold return values of paragraph analysis

  // cache lengths for iteration later
  var i = rel_wrds.length, j = 0;
  var m = lsi_wrds.length, n = 0;

  // if plain is not a strings or is missing,
  // or if we cannot execute regex match on plain, return undefined
  switch (true) {
    case !!(typeof plain !== 'string' || !plain):
    case !!(typeof plain.match !== 'function'):
      return;
  }

  // use ternaries to handle the possibility of zero matches without throwing
  _wrds = plain.match(/\w+/gi) ?
    plain.match(/\w+/gi) : [];

  _paras = plain.split('\n') ?
    plain.split('\n') : [];

  _sntcs = plain.match(/[^\.!\?\n]+[\.!\?\n]+/g) ?
    plain.match(/[^\.!\?\n]+[\.!\?\n]+/g) : [];

  _psv_v = plain.match(/(was|were)(\s|\n)[a-z]*(ing|ed)(\s|\n)by(\s|\n)/g) ?
    plain.match(/(was|were)(\s|\n)[a-z]*(ing|ed)(\s|\n)by(\s|\n)/g) : [];

  _prd_lc = plain.match(/\.+\s+[a-z]/g) ?
    plain.match(/\.+\s+[a-z]/g) : [];

  // we avoid standard acronyms by seeking more than one caps character,
  // followed by another caps character, followed by a word boundary and then two more
  // caps character, e.g. WE[LL]\b[DO]NE
  _all_uc = plain.match(/([A-Z]+[A-Z]+\s+[A-Z]+[A-Z])/g) ?
    plain.match(/([A-Z]+[A-Z]+\s+[A-Z]+[A-Z])/g) : [];

  // we initialised variables with value 0, and companion arrays as [],
  // so only amend the variables if the length of their companion arrays has changed
  if (_wrds.length > 0) {
    _wc = _wrds.length;
  }

  if (_sntcs.length > 0) {
    _sntc_data = checkSentences(_sntcs);
  }

  if (_paras.length > 0) {
    _para_data = checkParagraphs(_paras, keyword);
  }

  if (_sntcs.length > 0) {
    _rdblty = getReadabilityScore(_sntcs, _wrds);
    _smog = _sntcs.length > 29 ? getSMOGScore(_sntcs, _wrds) : 0;
  }

  // it is plausible that no keyword/related words/lsi words will be specified,
  // better not to throw an error under those circumstances
  if (typeof keyword !== 'undefined' && !!keyword) {
    _kc = matchString(plain, keyword, false);
  }

  if (typeof rel_wrds !== 'undefined' && i > 0) {
    for (; j < i; ++j) {
      _rc += matchString(plain, rel_wrds[j], true);
    }
  }

  if (typeof lsi_wrds !== 'undefined' && m > 0) {
    for (; n < m; ++n) {
      _lc += matchString(plain, lsi_wrds[n], true);
    }
  }

  // crucial: here we return the message data object
  // use an object literal to avoid adding to the lookup chain or creating more variables
  return {
    'word_count': _wc,
    'keyword_density': (_kc / _wc * 100 << 0),
    'related_word_density': (_rc / _wc * 100 << 0),
    'lsi_word_density': (_lc / _wc * 100 << 0),
    'transition_word_density': (_sntc_data[0] / _sntcs.length * 100 << 0),
    'readability': _rdblty,
    'smog_readability': _smog,
    'passive_voice': _psv_v,
    'period_lowercase': _prd_lc,
    'all_caps': _all_uc,
    'keyword_in_first_para': _para_data[0],
    'paragraphs_too_long': _para_data[1],
    'sentences_too_long': _sntc_data[1]
  };
}

// we want to check if the keyword is present in the first paragraph,
// and we want to warn the user if their paragraphs are too long
function checkParagraphs (paras, keyword) {
  var _first = 'No';
  var _para_wc = 0;
  var _warn = false;
  var i = paras.length;
  var j = 0;

  if (i > 0) {
    if (typeof keyword !== 'undefined' && !!matchString(paras[0], keyword, false)) {
      _first = 'Yes';
    }

    for (; j < i; ++j) {
      if (paras[j].split(' ').length < 200) {
        _para_wc++;
      }
    }
    if ((_para_wc / i * 100 << 0) < 80) {
      _warn = true;
    }
  }

  return [_first, _warn];
}

// check sentences for transition words/phrases,
// and warn about long sentences
function checkSentences (sntcs) {
  var _trs_words = ['I mean','above all','accordingly','as a consequence','actually','additionally','admittedly','after this','afterwards','albeit','all in all','all the same','also','alternatively','although','altogether','and yet','anyhow','anyway','as I have said','as a final point','as a matter of fact','as a result','as an illustration','as for','as has been mentioned','as has been noted','as long as','as was previously stated','as well','at any rate','at first','at last','be that as it may','because of the fact','before this','besides','briefly','but','but also','but even so','by the same token','by the way','by way of contrast','by way of example','concerning','consequently','considering','conversely','despite','due to the fact','either','either way','equally','ergo','especially','even if','even more','even though','eventually','finally','first of all','firstly','for a start','for as much as','for example','for fear','for instance','for one thing','for starters','for the purpose of','for the simple reason that','for this reason','further','furthermore','given that','given these points','granted that','granting that','hence','however','if not','if so','in a like manner','in a word','in addition to','in all honesty','in any case','in any event','in as much as','in case','in conclusion','in consequence','in contrast','in either case','in either event','in fact','in light of the fact','in order that','in order to','in other words','in particular','in short','in spite of','in summary','in that case','in that since','in the end','in the event that','in the first place','in the hope that','in the same way','in view of the fact','incidentally','including','indeed','initially','instead','last but not least','lastly','lest','let alone','likewise','long story short','more importantly','moreover','much less','namely','neither','nevertheless','next','nonetheless','nor','not only','not to mention','notably','notwithstanding','on the condition that','on the other hand','on the subject of','on the whole','only if','or at least','otherwise','overall','owing to the fact','particularly','previously','provided that','providing that','rather','regarding','regardless','secondly','seeing that','similarly','so as to','so long as','so much so that','so that','speaking of which','specifically','still','subsequently','such as','that being the case','that is to say','therefore','thirdly','though','thus','to be brief','to begin with','to change the topic','to conclude','to get back to the point','to illustrate','to put it another way','to put it briefly','to resume','to return to the subject','to say nothing of','to start with','to sum up','to summarize','to tell the truth','to the end that','under those circumstances','unless,what is more','whatever happens','when in fact','whereas','whichever happens','while','with regards to','with this in mind'];
  var _tc = 0;
  var _sntc_wc = 0;
  var _warn = false;
  var i = sntcs.length;
  var j = 0;
  var m = _trs_words.length;
  var n = 0;

  if (i > 0) {
    for (; j < i; ++j) {
      if (sntcs[j].split(' ').length < 30) {
        _sntc_wc++;
      }

      for (; n < m; ++n) {
        if (!!matchString(sntcs[j], _trs_words[n], true)) {
          _tc++;
        }
      }
    }

    if (_warn === false && (_sntc_wc / i * 100 << 0) < 80) {
      _warn = true;
    }
  }

  return [_tc, _warn];
}

// our generic matchString function also used on the main thread (sparingly)
// for keywords in HTML headings
function matchString (string, to_match, exact) {
  var _is_phrase; // if to_match is a phrase
  var _rgx;       // the regular expression pattern
  var _idx;       // the regex matches

  // if string/to_match not present or not strings, return no matches
  // no point throwing an error and breaking everything
  switch (true) {
    case !!(typeof string !== 'string'):
    case !!(typeof to_match !== 'string'):
    case !(string):
    case !(to_match):
      return 0;
  }

  // _is_phrase is now a boolean, true if the keyword can be divided into space-
  // delimited sections, which would indicate multiple words
  _is_phrase = !!(to_match.split(' ').length > 1);

  // because we are matching a dynamic word/phrase, we need to use the RegExp constructor
  // because single words should also have their plural forms checked, we need to use a ternary
  // to conditionally construct one of two types of RegEx
  // the `exact` parameter is a boolean flag for forcing exact word/phrase matching
  _rgx = ((typeof exact !== 'undefined' && !!exact) || !!_is_phrase) ?
    to_match :
      to_match + '|' + to_match + 's|' + to_match + 'i?es';

  // insert the `_rgx` expression between word boundary characters to ensure proper matching
  // greedy and case insensitive, because we want to retrieve all possible matches
  _idx = string.match(new self.RegExp('\\b(' + _rgx + ')\\b', 'gi'));

  if (!!_idx && _idx.length > 0) {
    return _idx.length;
  }

  return 0;
}

// flesch-kincaid readability score
// maximum of 100 and minimum of 0
function getReadabilityScore (sntcs, wrds) {
  var _syll = 0;
  var _score = 0;
  var i = wrds.length;
  var j = 0;

  if (sntcs.length < 1 || wrds.length < 1) {
    return 'N/A';
  }

  for (; j < i; ++j) {
    _syll += countSyllables(wrds[j]);
  }

  if (_syll > 0) {
    _score = (206.835 - 1.015 * (wrds.length / sntcs.length) - 84.6 * (_syll / wrds.length)).toFixed(1);
  }

  return _score > 100 ? '100.0' : _score < 0 ? '0.0' : _score;
}

// SMOG readability score
// this formula is only accurate with 30+ sentences
// but the formula remains the same, so only call when sntcs.length > 30
// which we check in the actual analysis function which makes a call to this function
function getSMOGScore (sntcs, wrds) {
  var _smog = 0;
  var _p_syll = 0;
  var i = wrds.length;
  var j = 0;

  if (sntcs.length < 1 || wrds.length < 1) {
    return 'N/A';
  }

  for (; j < i; ++j) {
    if (countSyllables(wrds[j]) > 2) {
      _p_syll += countSyllables(wrds[j]);
    }
  }

  if (_p_syll > 0) {
    _smog = (1.0430 * self.Math.sqrt(_p_syll * (30 / sntcs.length)) + 3.1291).toFixed(1);
  }

  return _smog > 100 ? '100.0' : _smog < 0 ? '0.0' : _smog;
}

function countSyllables (word) {
  var _wrd = clean(word);

  if (word.length <= 3) {
    return 1;
  }

  _wrd = _wrd.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  _wrd = _wrd.replace(/^y/, '');

  return _wrd.match(/[aeiouy]{1,2}/g) ? _wrd.match(/[aeiouy]{1,2}/g).length : 1;
}

// remove whitespace at beginning and end, remove unwanted symbols and force lower case
function clean (word) {
  if (typeof word !== 'string') {
    throw new self.TypeError('Expected param of type \'string\'; received: ' + typeof word);
  }
  return word.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,'').toLowerCase();
}
