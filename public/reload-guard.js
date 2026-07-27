// Na een deploy verandert de bestandsnaam van de app-bundel. Een browser met
// een verouderde index.html probeert dan een bundel te laden die niet meer
// bestaat (en krijgt HTML terug -> MIME-fout). Dit vangnet herlaadt de pagina
// dan één keer, zodat de bezoeker de nieuwe versie krijgt zonder zelf
// Ctrl+Shift+R te hoeven doen.
window.addEventListener(
  'error',
  function (e) {
    var el = e.target
    if (!el || el.tagName !== 'SCRIPT' || el.type !== 'module') return
    try {
      if (sessionStorage.getItem('legolan-herladen')) return
      sessionStorage.setItem('legolan-herladen', '1')
    } catch {
      /* private mode: dan maar zonder herhaalbeveiliging */
    }
    location.reload()
  },
  true,
)
