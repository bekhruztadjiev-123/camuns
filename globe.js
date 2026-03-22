/* MUN Central Asia — globe.js */
/* ═══════════════════════════════════════════
   GLOBE ANIMATION
   ═══════════════════════════════════════════ */
(function() {
  var canvas = document.getElementById('globe-canvas');
  var ctx = canvas.getContext('2d');
  var dots = [];
  var W, H;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Seed dots from approximate world city positions mapped to canvas
  var citySeeds = [
    [.5,.38],[.52,.42],[.48,.44],[.55,.36],[.45,.5],[.58,.48],
    [.42,.34],[.38,.4],[.62,.3],[.65,.45],[.35,.55],[.7,.5],
    [.28,.45],[.75,.38],[.8,.55],[.22,.5],[.18,.42],[.85,.42],
    [.6,.6],[.4,.62],[.5,.58],[.55,.65],[.45,.68],[.3,.35],
    [.68,.35],[.72,.6],[.25,.58],[.82,.35],[.15,.5],[.9,.48]
  ];

  for (var i = 0; i < citySeeds.length; i++) {
    dots.push({
      bx: citySeeds[i][0], by: citySeeds[i][1],
      x: 0, y: 0,
      vx: (Math.random()-.5)*.15,
      vy: (Math.random()-.5)*.1,
      r: Math.random()*1.5+1,
      o: Math.random()*.5+.3,
      phase: Math.random()*Math.PI*2
    });
  }

  var t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += .008;

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var dotColor  = isDark ? 'rgba(201,168,76,' : 'rgba(100,72,18,';
    var lineColor = isDark ? 'rgba(201,168,76,' : 'rgba(100,72,18,';
    // Boost opacity in light mode so dots are visible against pale background
    var opacityMult = isDark ? 1 : 2.8;

    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      d.x = (d.bx + Math.sin(t * .4 + d.phase) * .03) * W;
      d.y = (d.by + Math.cos(t * .3 + d.phase) * .02) * H;

      // draw connections
      for (var j = i+1; j < dots.length; j++) {
        var d2 = dots[j];
        d2.x = (d2.bx + Math.sin(t*.4+d2.phase)*.03)*W;
        d2.y = (d2.by + Math.cos(t*.3+d2.phase)*.02)*H;
        var dx = d.x - d2.x, dy = d.y - d2.y;
        var dist = Math.sqrt(dx*dx+dy*dy);
        var maxDist = W * .22;
        if (dist < maxDist) {
          var alpha = (1 - dist/maxDist) * .18;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d2.x, d2.y);
          ctx.strokeStyle = lineColor + (alpha * opacityMult) + ')';
          ctx.lineWidth = isDark ? .8 : 1.2;
          ctx.stroke();
        }
      }
    }

    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var pulse = Math.sin(t * 1.2 + d.phase) * .15 + .85;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * pulse, 0, Math.PI*2);
      ctx.fillStyle = dotColor + Math.min(1, d.o * pulse * opacityMult) + ')';
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }
  draw();
})();
