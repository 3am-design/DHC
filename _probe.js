window.addEventListener('load', function(){
  setTimeout(function(){
    var t = document.querySelector('.nav__link[data-mega="work"]');
    if(t) t.dispatchEvent(new MouseEvent('mouseenter', {bubbles:true}));
    setTimeout(function(){
      var panel = document.querySelector('.nav__mega-panel[data-mega-panel="work"]');
      var hasImg = !!panel.querySelector('img.nav__mega-art');
      var hasSvg = !!panel.querySelector('svg.nav__mega-art');
      var draw = panel.querySelector('svg.nav__mega-art');
      var kind = draw ? (draw.dataset.draw||'?') : 'none';
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var ov = !!panel.querySelector('.nav__mega-art__trace');
      document.title='reduce='+reduce+' img='+hasImg+' svg='+hasSvg+' kind='+kind+' overlay='+ov;
    }, 400);
  }, 1000);
});
