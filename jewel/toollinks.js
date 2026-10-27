// Links to the other tools: on this computer they are separate local servers (one port each); on a website they are folders next to each other.
// Anchors carry data-tool="advisor|jewel|tablet|hub"; their href already holds the local address, so nothing breaks if this script does not run.
(function () {
  "use strict";
  var host = location.hostname, local = host === "127.0.0.1" || host === "localhost";
  if (local) return;
  var PATH = { advisor: "../advisor/index.html", jewel: "../jewel/jewel_sim.html", tablet: "../tablet/tablet_sim.html", hub: "../index.html" };
  var links = document.querySelectorAll("a[data-tool]");
  for (var i = 0; i < links.length; i++) { var p = PATH[links[i].getAttribute("data-tool")]; if (p) links[i].setAttribute("href", p); }
})();
