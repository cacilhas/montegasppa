do ->
  newMathJax = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.1/MathJax.js'
  oldMathJax = 'cdn.mathjax.org/mathjax/latest/MathJax.js'

  replaceScript = (script, src) ->
    #
    #  Make redirected script
    #
    newScript = document.createElement('script')
    newScript.src = newMathJax + src.replace(/.*?(\?|$)/, '$1')
    #
    #  Move onload and onerror handlers to new script
    #
    newScript.onload = script.onload
    newScript.onerror = script.onerror
    script.onload = script.onerror = null
    #
    #  Move any content (old-style configuration scripts)
    #
    while script.firstChild
      newScript.appendChild script.firstChild
    #
    #  Copy script id
    #
    if script.id != null
      newScript.id = script.id
    #
    #  Replace original script with new one
    #
    script.parentNode.replaceChild newScript, script
    #
    #  Issue a console warning
    #
    console.warn 'WARNING: cdn.mathjax.org has been retired. Check https://www.mathjax.org/cdn-shutting-down/ for migration tips.'
    return

  if document.currentScript
    script = document.currentScript
    replaceScript script, script.src
  else
    #
    # Look for current script by searching for one with the right source
    #
    n = oldMathJax.length
    scripts = document.getElementsByTagName('script')
    i = 0
    while i < scripts.length
      script = scripts[i]
      src = (script.src or '').replace(/.*?:\/\//, '')
      if src.substr(0, n) == oldMathJax
        replaceScript script, src
        break
      i++
