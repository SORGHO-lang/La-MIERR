/* ==========================================================================
   MIERR — Script principal (aucune dépendance externe)
   ========================================================================== */
(function () {
  "use strict";

  /* --- Numéro WhatsApp de la MIERR : à renseigner ici une fois pour toutes les pages --- */
  var WHATSAPP_NUMERO = ""; // ex. "243900000000" (indicatif pays sans le +)
  var WHATSAPP_MESSAGE = "Bonjour MIERR, je souhaite avoir des renseignements.";

  document.addEventListener("DOMContentLoaded", function () {
    initAnneeCourante();
    initWhatsapp();
    initMenuMobile();
    initBarreProgression();
    initAnimationsDefilement();
    initLightbox();
    initFiltresGalerie();
  });

  /* Année courante dans le pied de page */
  function initAnneeCourante() {
    var cibles = document.querySelectorAll("[data-annee]");
    var annee = new Date().getFullYear();
    cibles.forEach(function (el) { el.textContent = annee; });
  }

  /* Liens WhatsApp : construit l'URL wa.me si un numéro est configuré */
  function initWhatsapp() {
    var liens = document.querySelectorAll("[data-whatsapp]");
    if (!liens.length) return;
    var url = WHATSAPP_NUMERO
      ? "https://wa.me/" + WHATSAPP_NUMERO + "?text=" + encodeURIComponent(WHATSAPP_MESSAGE)
      : "#";
    liens.forEach(function (lien) {
      lien.setAttribute("href", url);
      lien.setAttribute("target", "_blank");
      lien.setAttribute("rel", "noopener");
      if (!WHATSAPP_NUMERO) {
        lien.addEventListener("click", function (evenement) {
          evenement.preventDefault();
          alert("Le numéro WhatsApp de la MIERR n'a pas encore été configuré (voir assets/js/script.js).");
        });
      }
    });
  }

  /* Menu mobile */
  function initMenuMobile() {
    var ouvrir = document.querySelector(".bouton-menu");
    var fermer = document.querySelector(".fermer-menu");
    var menu = document.querySelector(".menu-mobile");
    if (!ouvrir || !menu) return;

    function ouvrirMenu() {
      menu.classList.add("ouvert");
      document.body.style.overflow = "hidden";
    }
    function fermerMenu() {
      menu.classList.remove("ouvert");
      document.body.style.overflow = "";
    }

    ouvrir.addEventListener("click", ouvrirMenu);
    if (fermer) fermer.addEventListener("click", fermerMenu);
    menu.querySelectorAll("a").forEach(function (lien) {
      lien.addEventListener("click", fermerMenu);
    });
    document.addEventListener("keydown", function (evenement) {
      if (evenement.key === "Escape") fermerMenu();
    });
  }

  /* Barre de progression de lecture */
  function initBarreProgression() {
    var barre = document.querySelector(".barre-progression");
    if (!barre) return;
    function actualiser() {
      var hauteur = document.documentElement.scrollHeight - window.innerHeight;
      var pourcentage = hauteur > 0 ? (window.scrollY / hauteur) * 100 : 0;
      barre.style.width = pourcentage + "%";
    }
    document.addEventListener("scroll", actualiser, { passive: true });
    actualiser();
  }

  /* Apparition progressive des blocs marqués data-anim au défilement */
  function initAnimationsDefilement() {
    var elements = document.querySelectorAll("[data-anim]");
    if (!elements.length) return;

    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (el) { el.classList.add("visible"); });
      return;
    }

    var observateur = new IntersectionObserver(
      function (entrees) {
        entrees.forEach(function (entree) {
          if (entree.isIntersecting) {
            entree.target.classList.add("visible");
            observateur.unobserve(entree.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    elements.forEach(function (el) { observateur.observe(el); });
  }

  /* Visionneuse (lightbox) pour la galerie photo et les vignettes vidéo */
  function initLightbox() {
    var lightbox = document.querySelector(".lightbox");
    if (!lightbox) return;

    var image = lightbox.querySelector("img");
    var legende = lightbox.querySelector(".lightbox-legende");
    var boutonFermer = lightbox.querySelector(".lightbox-fermer");
    var boutonPrecedent = lightbox.querySelector(".lightbox-precedent");
    var boutonSuivant = lightbox.querySelector(".lightbox-suivant");

    var items = [];
    var indexCourant = 0;

    function rassemblerItems() {
      items = Array.prototype.slice.call(document.querySelectorAll(".galerie-item"));
    }

    function ouvrirIndex(index) {
      if (!items.length) return;
      indexCourant = (index + items.length) % items.length;
      var item = items[indexCourant];
      var video = item.getAttribute("data-video");

      if (video) {
        // Vignette vidéo sans source configurée pour le moment
        if (!video.trim()) {
          alert("Cette vidéo n'a pas encore été configurée (attribut data-video).");
          return;
        }
        window.open(video, "_blank", "noopener");
        return;
      }

      var img = item.querySelector("img");
      if (!img) return;
      image.src = img.getAttribute("src");
      image.alt = img.getAttribute("alt") || "";
      legende.textContent = img.getAttribute("alt") || "";
      lightbox.classList.add("ouverte");
      document.body.style.overflow = "hidden";
    }

    function fermerLightbox() {
      lightbox.classList.remove("ouverte");
      document.body.style.overflow = "";
      image.src = "";
    }

    rassemblerItems();
    document.addEventListener("click", function (evenement) {
      var declencheur = evenement.target.closest(".galerie-item");
      if (!declencheur) return;
      rassemblerItems();
      var index = items.indexOf(declencheur);
      ouvrirIndex(index);
    });

    if (boutonFermer) boutonFermer.addEventListener("click", fermerLightbox);
    if (boutonPrecedent) boutonPrecedent.addEventListener("click", function () { ouvrirIndex(indexCourant - 1); });
    if (boutonSuivant) boutonSuivant.addEventListener("click", function () { ouvrirIndex(indexCourant + 1); });

    lightbox.addEventListener("click", function (evenement) {
      if (evenement.target === lightbox) fermerLightbox();
    });
    document.addEventListener("keydown", function (evenement) {
      if (!lightbox.classList.contains("ouverte")) return;
      if (evenement.key === "Escape") fermerLightbox();
      if (evenement.key === "ArrowLeft") ouvrirIndex(indexCourant - 1);
      if (evenement.key === "ArrowRight") ouvrirIndex(indexCourant + 1);
    });
  }

  /* Filtres de la page Galerie (data-filtre sur les boutons, data-categorie sur les images) */
  function initFiltresGalerie() {
    var boutons = document.querySelectorAll(".filtre-bouton");
    var items = document.querySelectorAll("[data-categorie]");
    if (!boutons.length || !items.length) return;

    boutons.forEach(function (bouton) {
      bouton.addEventListener("click", function () {
        boutons.forEach(function (b) { b.classList.remove("actif"); });
        bouton.classList.add("actif");
        var filtre = bouton.getAttribute("data-filtre");

        items.forEach(function (item) {
          var correspond = filtre === "tous" || item.getAttribute("data-categorie") === filtre;
          item.style.display = correspond ? "" : "none";
        });
      });
    });
  }
})();
