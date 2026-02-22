(function () {
  var theme = 'dark';
  try {
    var storedTheme = window.localStorage.getItem('workout-tracker-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      theme = storedTheme;
    }
  } catch (_) {
    // Ignore read errors.
  }

  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;

  var themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', theme === 'dark' ? '#1a1c24' : '#fbfcff');
  }
})();
