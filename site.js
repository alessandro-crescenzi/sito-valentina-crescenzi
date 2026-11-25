/* Costruisce indirizzo, orari, contatti e dati strutturati a partire da STUDIO e ORARI
   (definiti in index.html). Il blocco BUILDER è senza DOM: lo usa anche
   .strumenti/genera-statico.mjs per scrivere lo stesso risultato nell'HTML statico.
   Se lo modifichi, rilancia: node .strumenti/genera-statico.mjs */
/*#BUILDER-INIZIO*/
function costruisciDati(S, O, prenotaUrl) {
  var cittaProv = S.cap + " " + S.citta + " (" + S.provincia + ")";
  var telPulito = S.telefono.replace(/\s+/g, "");
  if (telPulito.charAt(0) !== "+") { telPulito = "+39" + telPulito; }
  var mappaHref = "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(S.via + ", " + cittaProv);

  var righe = O.map(function (g) {
    return {
      giorno: g.giorno,
      orario: g.fasce.length
        ? g.fasce.map(function (f) { return f[0] + " – " + f[1]; }).join(" / ")
        : "Chiuso"
    };
  });

  var specifiche = [];
  O.forEach(function (g) {
    g.fasce.forEach(function (f) {
      specifiche.push({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: g.en,
        opens: f[0],
        closes: f[1]
      });
    });
  });

  var sito = "https://drcrescenzi.it/";
  var ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": sito + "#sito",
        url: sito,
        name: "Dott.ssa Valentina Crescenzi",
        inLanguage: "it-IT",
        publisher: { "@id": sito + "#studio" }
      },
      {
        "@type": "Physician",
        "@id": sito + "#studio",
        name: "Dott.ssa Valentina Crescenzi",
        url: sito,
        description: "Medico chirurgo e medico sostituto a " + S.citta + ".",
        telephone: "+39 " + S.telefono.replace(/^\+39\s*/, ""),
        email: S.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: S.via,
          addressLocality: S.citta,
          addressRegion: S.provincia,
          postalCode: S.cap,
          addressCountry: "IT"
        },
        areaServed: { "@type": "City", name: S.citta },
        hasMap: mappaHref,
        openingHoursSpecification: specifiche,
        potentialAction: {
          "@type": "ReserveAction",
          name: "Prenota una visita",
          target: {
            "@type": "EntryPoint",
            urlTemplate: prenotaUrl,
            inLanguage: "it-IT",
            actionPlatform: [
              "https://schema.org/DesktopWebPlatform",
              "https://schema.org/MobileWebPlatform"
            ]
          }
        }
      }
    ]
  };

  return {
    cittaProv: cittaProv,
    mappaHref: mappaHref,
    telHref: "tel:" + telPulito,
    mailHref: "mailto:" + S.email,
    righe: righe,
    jsonLd: JSON.stringify(ld).replace(/</g, "\\u003c")
  };
}
/*#BUILDER-FINE*/

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var d = costruisciDati(STUDIO, ORARI, $("prenota").getAttribute("href"));

  Array.prototype.forEach.call(document.querySelectorAll("[data-studio]"), function (el) {
    el.textContent = STUDIO[el.dataset.studio];
  });

  var ind = $("indirizzo");
  ind.textContent = "";
  ind.appendChild(document.createTextNode(STUDIO.via));
  ind.appendChild(document.createElement("br"));
  ind.appendChild(document.createTextNode(d.cittaProv));

  $("mappa").href = d.mappaHref;

  var tel = $("telefono");
  tel.href = d.telHref;
  tel.textContent = STUDIO.telefono;

  var mail = $("email");
  mail.href = d.mailHref;
  mail.textContent = STUDIO.email;

  var tbody = $("tabella-orari");
  tbody.textContent = "";
  d.righe.forEach(function (r) {
    var tr = document.createElement("tr");
    var th = document.createElement("th");
    th.scope = "row";
    th.textContent = r.giorno;
    var td = document.createElement("td");
    td.textContent = r.orario;
    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });

  $("dati-strutturati").textContent = d.jsonLd;

  /* Barra «Prenota / Chiama» su schermi stretti. Il link di prenotazione è letto dal pulsante
     #prenota (mai riscritto qui); il telefono viene da STUDIO. */
  var barra = document.createElement("nav");
  barra.className = "barra-mobile";
  barra.setAttribute("aria-label", "Azioni rapide");

  var prenota = document.createElement("a");
  prenota.className = "azione-prenota";
  prenota.href = $("prenota").getAttribute("href");
  prenota.rel = "noopener";
  prenota.textContent = "Prenota";

  var chiama = document.createElement("a");
  chiama.className = "azione-chiama";
  chiama.href = d.telHref;
  chiama.setAttribute("aria-label", "Chiama lo studio al " + STUDIO.telefono);
  chiama.textContent = "Chiama";

  barra.appendChild(prenota);
  barra.appendChild(chiama);
  document.body.appendChild(barra);
  document.documentElement.className += " con-barra";
})();
