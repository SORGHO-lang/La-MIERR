/* ==========================================================================
   MIERR — Script principal
   JavaScript natif, sans dépendance, organisé en petits modules autonomes.
   Chaque module vérifie la présence de ses éléments avant de s'exécuter :
   ce même fichier peut donc être chargé sur toutes les pages du site.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = (window.MIERR && window.MIERR.config) || {};

  /* ---------- Utilitaires ---------- */
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }

  document.addEventListener("DOMContentLoaded", function () {
    injecterConfig();
    initBarreProgression();
    initEntete();
    initMenuMobile();
    initAnimationsRevelation();
    initAnneeCourante();
    initWhatsapp();
    initModaleVideo();
    initOnglets();
    initAccordeon();
    initRetourHaut();
    initRecherche();
    initFilDuTemps();
    initFormulaires();
    initCompteurs();

    /* Le calendrier, les cartes d'événements, la galerie, les actualités et
       la lightbox dépendent potentiellement du contenu distant (content/*.json,
       éditable depuis /admin) : on attend le résultat du chargement (succès
       ou échec) avant de les initialiser, pour n'activer chaque fonctionnalité
       qu'une seule fois avec des données définitives. */
    chargerContenuDistant().then(function (etat) {
      if (etat.evenementsChanges) {
        actualiserListeEvenements(window.MIERR.evenements);
        actualiserProchainsEvenements(window.MIERR.evenements);
      }
      initCalendrier();
      initFiltresAgenda();
      initFiltresGalerie();
      initLightbox();
      initAnimationsRevelation();
    });
  });

  /* ---------- Injection des coordonnées (data-config) ----------
     <span data-config="telephone"></span> ou <a data-config-href="email">
     permet de centraliser les coordonnées dans data.js. */
  function injecterConfig() {
    $$("[data-config]").forEach(function (el) {
      var cle = el.getAttribute("data-config");
      if (CFG[cle] !== undefined) el.textContent = CFG[cle];
    });
    $$("[data-config-href]").forEach(function (el) {
      var cle = el.getAttribute("data-config-href");
      if (cle === "email" && CFG.email) el.href = "mailto:" + CFG.email;
      else if (cle === "telephone" && CFG.telephoneLien) el.href = "tel:" + CFG.telephoneLien;
      else if (CFG[cle]) el.href = CFG[cle];
    });
    $$("[data-maps-embed]").forEach(function (el) {
      if (CFG.mapsEmbed) el.src = CFG.mapsEmbed;
    });
  }

  /* ---------- Barre de progression de lecture ---------- */
  function initBarreProgression() {
    var barre = $(".barre-progression");
    if (!barre) return;
    var majBarre = function () {
      var h = document.documentElement;
      var hauteur = h.scrollHeight - h.clientHeight;
      var pourcent = hauteur > 0 ? (h.scrollTop / hauteur) * 100 : 0;
      barre.style.width = pourcent + "%";
    };
    document.addEventListener("scroll", majBarre, { passive: true });
    majBarre();
  }

  /* ---------- En-tête : ombre au défilement ---------- */
  function initEntete() {
    var entete = $(".entete");
    if (!entete) return;
    var maj = function () {
      if (window.scrollY > 12) entete.classList.add("entete--flottant");
      else entete.classList.remove("entete--flottant");
    };
    document.addEventListener("scroll", maj, { passive: true });
    maj();
  }

  /* ---------- Menu mobile ---------- */
  function initMenuMobile() {
    var bouton = $(".bouton-menu");
    var menu = $(".menu-mobile");
    var fermer = $(".fermer-menu");
    if (!bouton || !menu) return;
    var ouvrir = function () {
      menu.classList.add("ouvert");
      document.body.classList.add("verrouille");
      bouton.setAttribute("aria-expanded", "true");
    };
    var fermerMenu = function () {
      menu.classList.remove("ouvert");
      document.body.classList.remove("verrouille");
      bouton.setAttribute("aria-expanded", "false");
    };
    bouton.addEventListener("click", ouvrir);
    if (fermer) fermer.addEventListener("click", fermerMenu);
    $$("a", menu).forEach(function (a) { a.addEventListener("click", fermerMenu); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fermerMenu();
    });
  }

  /* ---------- Révélation au défilement ---------- */
  function initAnimationsRevelation() {
    var elements = $$("[data-anim]");
    if (!elements.length) return;
    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (el) { el.classList.add("visible"); });
      return;
    }
    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree, i) {
        if (entree.isIntersecting) {
          setTimeout(function () { entree.target.classList.add("visible"); }, (i % 6) * 60);
          observateur.unobserve(entree.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    elements.forEach(function (el) { observateur.observe(el); });
  }

  /* ---------- Année courante (pied de page) ---------- */
  function initAnneeCourante() {
    $$("[data-annee]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Liens WhatsApp ---------- */
  function initWhatsapp() {
    var numero = (CFG.whatsapp || "").replace(/[^\d+]/g, "").replace("+", "");
    if (!numero) return;
    $$("[data-whatsapp]").forEach(function (el) {
      var message = encodeURIComponent(el.getAttribute("data-whatsapp-message") || "Bonjour, je souhaite avoir des renseignements sur la MIERR.");
      el.setAttribute("href", "https://wa.me/" + numero + "?text=" + message);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    });
  }

  /* ---------- Lightbox (galerie photos) ---------- */
  function initLightbox() {
    var items = $$(".galerie-item[data-lightbox], .galerie-grille .galerie-item");
    var boite = $(".lightbox");
    if (!boite || !items.length) return;
    var img = $("img", boite);
    var legende = $(".lightbox-legende", boite);
    var index = 0;

    var galerie = items.filter(function (el) { return el.querySelector("img"); });

    function ouvrirAIndex(i) {
      index = (i + galerie.length) % galerie.length;
      var source = galerie[index].querySelector("img");
      img.src = source.getAttribute("data-plein") || source.src;
      img.alt = source.alt || "";
      legende.textContent = galerie[index].getAttribute("data-legende") || source.alt || "";
      boite.classList.add("ouvert");
      document.body.classList.add("verrouille");
    }
    function fermerBoite() {
      boite.classList.remove("ouvert");
      document.body.classList.remove("verrouille");
    }

    galerie.forEach(function (el, i) {
      el.addEventListener("click", function () { ouvrirAIndex(i); });
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrirAIndex(i); }
      });
    });

    var btnFermer = $(".lightbox-fermer", boite);
    var btnPrec = $(".lightbox-precedent", boite);
    var btnSuiv = $(".lightbox-suivant", boite);
    if (btnFermer) btnFermer.addEventListener("click", fermerBoite);
    if (btnPrec) btnPrec.addEventListener("click", function () { ouvrirAIndex(index - 1); });
    if (btnSuiv) btnSuiv.addEventListener("click", function () { ouvrirAIndex(index + 1); });
    boite.addEventListener("click", function (e) { if (e.target === boite) fermerBoite(); });
    document.addEventListener("keydown", function (e) {
      if (!boite.classList.contains("ouvert")) return;
      if (e.key === "Escape") fermerBoite();
      if (e.key === "ArrowRight") ouvrirAIndex(index + 1);
      if (e.key === "ArrowLeft") ouvrirAIndex(index - 1);
    });
  }

  /* ---------- Modale vidéo (YouTube/Vimeo à intégrer) ---------- */
  function initModaleVideo() {
    var tuiles = $$(".video-tuile[data-video]");
    var modale = $(".modale-video");
    if (!modale || !tuiles.length) return;
    var cadre = $(".modale-video-cadre", modale);

    function ouvrir(urlVideo) {
      if (!urlVideo) return;
      cadre.innerHTML = '<iframe src="' + urlVideo + '" title="Lecteur vidéo MIERR" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      modale.classList.add("ouvert");
      document.body.classList.add("verrouille");
    }
    function fermer() {
      modale.classList.remove("ouvert");
      cadre.innerHTML = "";
      document.body.classList.remove("verrouille");
    }
    tuiles.forEach(function (t) {
      t.addEventListener("click", function () { ouvrir(t.getAttribute("data-video")); });
    });
    var btnFermer = $(".lightbox-fermer", modale);
    if (btnFermer) btnFermer.addEventListener("click", fermer);
    modale.addEventListener("click", function (e) { if (e.target === modale) fermer(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermer(); });
  }

  /* ---------- Onglets (départements, institut, médiathèque…) ---------- */
  function initOnglets() {
    $$("[data-onglets]").forEach(function (groupe) {
      var boutons = $$("[data-onglet]", groupe);
      var panneaux = $$("[data-panneau]", groupe);
      boutons.forEach(function (bouton) {
        bouton.addEventListener("click", function () {
          var cible = bouton.getAttribute("data-onglet");
          boutons.forEach(function (b) { b.classList.toggle("actif", b === bouton); });
          panneaux.forEach(function (p) { p.classList.toggle("actif", p.getAttribute("data-panneau") === cible); });
          history.replaceState(null, "", "#" + cible);
        });
      });
      var hash = window.location.hash.replace("#", "");
      if (hash) {
        var cibleBtn = boutons.filter(function (b) { return b.getAttribute("data-onglet") === hash; })[0];
        if (cibleBtn) cibleBtn.click();
      }
    });
  }

  /* ---------- Accordéon (FAQ, matières, programmes) ---------- */
  function initAccordeon() {
    $$(".accordeon-item").forEach(function (item) {
      var entete = $(".accordeon-entete", item);
      var corps = $(".accordeon-corps", item);
      if (!entete || !corps) return;
      entete.setAttribute("aria-expanded", "false");
      entete.addEventListener("click", function () {
        var estOuvert = item.classList.contains("ouvert");
        item.classList.toggle("ouvert", !estOuvert);
        entete.setAttribute("aria-expanded", String(!estOuvert));
        corps.style.maxHeight = !estOuvert ? corps.scrollHeight + "px" : null;
      });
    });
  }

  /* ---------- Retour en haut ---------- */
  function initRetourHaut() {
    var bouton = $(".retour-haut");
    if (!bouton) return;
    document.addEventListener("scroll", function () {
      bouton.classList.toggle("visible", window.scrollY > 600);
    }, { passive: true });
    bouton.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Recherche globale ---------- */
  function initRecherche() {
    var declencheurs = $$("[data-recherche-ouvrir]");
    var superposition = $(".recherche-superposition");
    if (!superposition || !declencheurs.length) return;
    var champ = $("input", superposition);
    var resultats = $(".recherche-resultats", superposition);
    var index = (window.MIERR && window.MIERR.recherche) || [];

    function rendre(liste) {
      if (!liste.length) {
        resultats.innerHTML = '<div class="recherche-vide">Aucun résultat. Essayez « SEMIC », « institut biblique », « convention »…</div>';
        return;
      }
      resultats.innerHTML = liste.map(function (r) {
        return '<a class="recherche-resultat" href="' + r.url + '">' +
          '<span class="categorie">' + r.categorie + '</span>' +
          '<h4>' + r.titre + '</h4><p>' + r.extrait + '</p></a>';
      }).join("");
    }

    function chercher(terme) {
      terme = terme.trim().toLowerCase();
      if (!terme) { rendre(index.slice(0, 6)); return; }
      var trouves = index.filter(function (r) {
        return (r.titre + " " + r.extrait + " " + r.categorie).toLowerCase().indexOf(terme) !== -1;
      });
      rendre(trouves);
    }

    function ouvrir() {
      superposition.classList.add("ouvert");
      document.body.classList.add("verrouille");
      rendre(index.slice(0, 6));
      setTimeout(function () { champ.focus(); }, 50);
    }
    function fermer() {
      superposition.classList.remove("ouvert");
      document.body.classList.remove("verrouille");
      champ.value = "";
    }

    declencheurs.forEach(function (b) { b.addEventListener("click", ouvrir); });
    var btnFermer = $("[data-recherche-fermer]", superposition);
    if (btnFermer) btnFermer.addEventListener("click", fermer);
    superposition.addEventListener("click", function (e) { if (e.target === superposition) fermer(); });
    champ.addEventListener("input", function () { chercher(champ.value); });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ouvrir(); }
      if (e.key === "Escape") fermer();
    });
  }

  /* ---------- Calendrier interactif (page Activités) ---------- */
  function initCalendrier() {
    var conteneur = $("[data-calendrier]");
    if (!conteneur) return;
    var evenements = (window.MIERR && window.MIERR.evenements) || [];
    var mapEvenements = {};
    evenements.forEach(function (ev) {
      var d = new Date(ev.debut + "T00:00:00");
      var cle = d.getFullYear() + "-" + d.getMonth();
      mapEvenements[cle] = mapEvenements[cle] || [];
      mapEvenements[cle].push(ev);
    });

    var aujourdhui = new Date();
    var courant = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
    var titre = $(".calendrier-entete h3", conteneur);
    var grille = $(".calendrier-grille", conteneur);
    var jours = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    var mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    function rendre() {
      var cle = courant.getFullYear() + "-" + courant.getMonth();
      var evsMois = mapEvenements[cle] || [];
      titre.textContent = mois[courant.getMonth()] + " " + courant.getFullYear();

      var html = jours.map(function (j) { return '<div class="calendrier-jour-nom">' + j + '</div>'; }).join("");
      var premierJour = new Date(courant.getFullYear(), courant.getMonth(), 1);
      var decalage = (premierJour.getDay() + 6) % 7; // lundi = 0
      var nbJours = new Date(courant.getFullYear(), courant.getMonth() + 1, 0).getDate();

      for (var i = 0; i < decalage; i++) html += '<div class="calendrier-case vide"></div>';
      for (var j2 = 1; j2 <= nbJours; j2++) {
        var estAuj = j2 === aujourdhui.getDate() && courant.getMonth() === aujourdhui.getMonth() && courant.getFullYear() === aujourdhui.getFullYear();
        var evDuJour = evsMois.filter(function (ev) {
          var d1 = new Date(ev.debut + "T00:00:00"), d2 = new Date(ev.fin + "T00:00:00");
          var date = new Date(courant.getFullYear(), courant.getMonth(), j2);
          return date >= d1 && date <= d2;
        });
        var classes = "calendrier-case" + (estAuj ? " aujourdhui" : "") + (evDuJour.length ? " evenement" : "");
        var titreEv = evDuJour.length ? ' title="' + evDuJour[0].titre + '" data-id="' + evDuJour[0].id + '"' : "";
        html += '<div class="' + classes + '"' + titreEv + '>' + j2 + '</div>';
      }
      grille.innerHTML = html;

      $$(".calendrier-case.evenement", grille).forEach(function (c) {
        c.addEventListener("click", function () {
          var cible = document.getElementById(c.getAttribute("data-id"));
          if (cible) cible.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }

    var btnPrec = $("[data-mois-precedent]", conteneur);
    var btnSuiv = $("[data-mois-suivant]", conteneur);
    if (btnPrec) btnPrec.addEventListener("click", function () { courant.setMonth(courant.getMonth() - 1); rendre(); });
    if (btnSuiv) btnSuiv.addEventListener("click", function () { courant.setMonth(courant.getMonth() + 1); rendre(); });
    rendre();
  }

  /* ---------- Filtres de l'agenda (par type d'événement) ---------- */
  function initFiltresAgenda() {
    var barre = $(".agenda-filtres");
    if (!barre) return;
    var boutons = $$(".filtre-tag", barre);
    var cartes = $$("[data-type-evenement]");
    boutons.forEach(function (bouton) {
      bouton.addEventListener("click", function () {
        boutons.forEach(function (b) { b.classList.remove("actif"); });
        bouton.classList.add("actif");
        var type = bouton.getAttribute("data-filtre");
        cartes.forEach(function (c) {
          var visible = type === "tous" || c.getAttribute("data-type-evenement") === type;
          c.style.display = visible ? "" : "none";
        });
      });
    });
  }

  /* ---------- Filtres de la galerie (par album/catégorie) ---------- */
  function initFiltresGalerie() {
    var barre = $(".galerie-filtres");
    if (!barre) return;
    var boutons = $$(".filtre-tag", barre);
    var items = $$("[data-album]");
    boutons.forEach(function (bouton) {
      bouton.addEventListener("click", function () {
        boutons.forEach(function (b) { b.classList.remove("actif"); });
        bouton.classList.add("actif");
        var album = bouton.getAttribute("data-filtre");
        items.forEach(function (it) {
          var visible = album === "tous" || it.getAttribute("data-album") === album;
          it.style.display = visible ? "" : "none";
        });
      });
    });
  }

  /* ---------- Fil du temps généré depuis data.js (option) ---------- */
  function initFilDuTemps() {
    var conteneur = $("[data-timeline-auto]");
    if (!conteneur) return;
    var etapes = (window.MIERR && window.MIERR.timeline) || [];
    conteneur.innerHTML = etapes.map(function (e) {
      return '<div class="timeline-etape" data-anim>' +
        '<span class="timeline-annee">' + e.annee + '</span>' +
        '<h4>' + e.titre + '</h4><p>' + e.texte + '</p></div>';
    }).join("");
    initAnimationsRevelation();
  }

  /* ---------- Formulaires (contact, inscription) — validation + statut ----------
     Aucun back-end n'étant branché, la soumission affiche un message de
     confirmation et journalise les données en console. Pour brancher un
     service réel, remplacer le bloc "// TODO ENVOI" par un fetch() vers
     votre API ou votre fournisseur de formulaires. */
  function initFormulaires() {
    $$("form[data-formulaire]").forEach(function (form) {
      var statut = $(".formulaire-statut", form.parentElement) || $(".formulaire-statut", form);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var valide = true;
        $$("[required]", form).forEach(function (champ) {
          var erreur = form.querySelector('.message-erreur[data-pour="' + champ.name + '"]');
          var estVide = champ.type === "checkbox" ? !champ.checked : !champ.value.trim();
          var estInvalide = champ.type === "email" && champ.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(champ.value);
          if (estVide || estInvalide) {
            valide = false;
            champ.classList.add("champ-erreur");
            if (erreur) erreur.classList.add("visible");
          } else {
            champ.classList.remove("champ-erreur");
            if (erreur) erreur.classList.remove("visible");
          }
        });

        if (!statut) return;
        statut.classList.remove("succes", "erreur");
        if (!valide) {
          statut.textContent = "Merci de corriger les champs signalés en rouge avant d'envoyer le formulaire.";
          statut.classList.add("erreur", "visible");
          return;
        }

        /* ---------- Envoi : ouverture du client e-mail avec le message pré-rempli ----------
           Aucun back-end n'étant branché sur ce site statique, le formulaire s'appuie
           sur un lien "mailto:" vers l'adresse officielle de la MIERR (voir data.js,
           propriété config.email). Pour brancher un vrai service d'envoi plus tard
           (API, formspree, etc.), remplacer ce bloc par un fetch() — voir LISEZ-MOI.md,
           section « Formulaires ». */
        var donnees = {};
        new FormData(form).forEach(function (v, k) { donnees[k] = v; });
        console.info("[MIERR] Formulaire prêt pour intégration back-end :", donnees);

        if (CFG.email) {
          var lignes = [];
          $$("[name]", form).forEach(function (champ) {
            if (champ.type === "checkbox" || !champ.name || !donnees[champ.name]) return;
            var etiquette = $('label[for="' + champ.id + '"]', form);
            var libelle = etiquette ? etiquette.textContent.replace(/\s*\*\s*$/, "").trim() : champ.name;
            lignes.push(libelle + " : " + donnees[champ.name]);
          });
          var sujetChamp = donnees.sujet ? donnees.sujet + " — " : "";
          var sujet = sujetChamp + (form.getAttribute("data-mail-sujet") || "Message depuis le site MIERR") + (donnees.nom ? " (" + donnees.nom + ")" : "");
          var corps = lignes.join("\n") + "\n\n— Message envoyé depuis le site officiel de la MIERR.";
          var lien = "mailto:" + CFG.email + "?subject=" + encodeURIComponent(sujet) + "&body=" + encodeURIComponent(corps);
          window.location.href = lien;
        }

        statut.textContent = form.getAttribute("data-message-succes") || "Merci ! Votre message a bien été enregistré. Notre équipe reviendra vers vous très rapidement.";
        statut.classList.add("succes", "visible");
        form.reset();
      });
    });
  }

  /* ---------- Compteurs animés (statistiques : 20 ans, départements…) ---------- */
  function initCompteurs() {
    var compteurs = $$("[data-compteur]");
    if (!compteurs.length) return;
    var anime = function (el) {
      var cible = parseInt(el.getAttribute("data-compteur"), 10) || 0;
      var duree = 1400, debut = null;
      function etape(horodatage) {
        if (!debut) debut = horodatage;
        var progression = Math.min((horodatage - debut) / duree, 1);
        el.textContent = Math.floor(progression * cible);
        if (progression < 1) requestAnimationFrame(etape);
        else el.textContent = cible;
      }
      requestAnimationFrame(etape);
    };
    if (!("IntersectionObserver" in window)) { compteurs.forEach(anime); return; }
    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree) {
        if (entree.isIntersecting) { anime(entree.target); observateur.unobserve(entree.target); }
      });
    }, { threshold: 0.5 });
    compteurs.forEach(function (el) { observateur.observe(el); });
  }

  /* ==========================================================================
     ESPACE D'ADMINISTRATION — contenu distant (content/*.json)
     --------------------------------------------------------------------------
     Ces fichiers JSON sont la source de vérité que l'espace /admin (PHP) lit
     et modifie. Les pages sont livrées avec le contenu déjà figé dans le HTML
     (généré au moment de la construction du site) : au chargement, ce module
     tente de récupérer une version plus récente et remplace le contenu figé
     si — et seulement si — la récupération réussit et que la liste n'est pas
     vide. Sur un site sans serveur (aperçu Artifact, ouverture du fichier en
     local), le fetch échoue silencieusement et la page garde son contenu
     d'origine : aucune régression, amélioration progressive uniquement.
     ========================================================================== */

  function chargerJSON(chemin) {
    return fetch(chemin, { cache: "no-store" })
      .then(function (reponse) { return reponse.ok ? reponse.json() : null; })
      .catch(function () { return null; });
  }

  function echapperHtml(valeur) {
    return String(valeur == null ? "" : valeur).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  function analyserDateISO(iso) {
    var p = (iso || "").split("-").map(Number);
    return { j: p[2], m: p[1] - 1, a: p[0] };
  }

  function formaterPlageDate(debutISO, finISO) {
    if (!debutISO) return "";
    var d = analyserDateISO(debutISO);
    if (!finISO || finISO === debutISO) return d.j + " " + NOMS_MOIS[d.m] + " " + d.a;
    var f = analyserDateISO(finISO);
    if (d.m === f.m && d.a === f.a) return d.j + " – " + f.j + " " + NOMS_MOIS[f.m] + " " + f.a;
    if (d.a === f.a) return d.j + " " + NOMS_MOIS[d.m] + " – " + f.j + " " + NOMS_MOIS[f.m] + " " + f.a;
    return d.j + " " + NOMS_MOIS[d.m] + " " + d.a + " – " + f.j + " " + NOMS_MOIS[f.m] + " " + f.a;
  }

  /* ---------- Agenda : cartes détaillées (page Activités) ---------- */
  function construireCarteEvenement(ev) {
    var image = ev.image || "assets/img/banniere-activites.svg";
    var plein = !!ev.image;
    var badge = ev.badge ? '<span class="badge badge--or" style="margin-bottom:14px;">' + echapperHtml(ev.badge) + "</span>" : "";
    var boutons = "";
    if (ev.boutons && ev.boutons.length) {
      boutons = '<div class="bouton-groupe" style="margin-top:20px;">' + ev.boutons.map(function (b) {
        return '<a href="' + echapperHtml(b.url) + '" class="bouton ' + echapperHtml(b.style || "bouton--bleu bouton--petit") + '">' + echapperHtml(b.texte) + "</a>";
      }).join("") + "</div>";
    }
    return '<article class="carte-evenement" id="' + echapperHtml(ev.id) + '" data-type-evenement="' + echapperHtml(ev.type) + '"' + (plein ? ' style="grid-template-columns:1fr;"' : "") + ">" +
      '<div class="carte-image"' + (plein ? ' style="aspect-ratio:auto; height:auto;"' : "") + '><img src="' + echapperHtml(image) + '" alt="' + echapperHtml(ev.titre) + '"' + (plein ? ' style="width:100%; height:auto; object-fit:contain; display:block;"' : "") + "></div>" +
      '<div class="carte-evenement-corps">' + badge +
      '<span class="carte-etiquette">' + echapperHtml(ev.type) + "</span>" +
      "<h3>" + echapperHtml(ev.titre) + "</h3>" +
      '<div class="evenement-meta"><span>📅 ' + formaterPlageDate(ev.debut, ev.fin) + '</span><span>📍 ' + echapperHtml(ev.lieu) + '</span><span>👤 ' + echapperHtml(ev.responsable) + "</span></div>" +
      "<p>" + echapperHtml(ev.description) + "</p>" +
      boutons +
      "</div></article>";
  }

  function actualiserListeEvenements(evenements) {
    var conteneur = $("#evenements-liste");
    if (!conteneur || !evenements || !evenements.length) return;
    conteneur.innerHTML = evenements.map(construireCarteEvenement).join("");
  }

  /* ---------- Agenda : rappel des prochains événements (accueil) ---------- */
  function construireLigneEvenement(ev) {
    var d = analyserDateISO(ev.debut);
    var moisAbrege = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    return '<div class="evenement-ligne" data-anim>' +
      '<div class="evenement-date"><span class="jour">' + d.j + '</span><br><span class="mois">' + moisAbrege[d.m] + "</span></div>" +
      '<div class="evenement-detail"><h4>' + echapperHtml(ev.titre) + '</h4><div class="evenement-meta"><span>📍 ' + echapperHtml(ev.lieu) + "</span></div></div>" +
      '<a href="activites.html#' + echapperHtml(ev.id) + '" class="bouton bouton--petit bouton--ligne">Détails</a>' +
      "</div>";
  }

  function actualiserProchainsEvenements(evenements) {
    var conteneur = $("#prochains-evenements");
    if (!conteneur || !evenements || !evenements.length) return;
    var aujourdhui = new Date().toISOString().slice(0, 10);
    var avenir = evenements
      .filter(function (e) { return (e.fin || e.debut) >= aujourdhui; })
      .sort(function (a, b) { return a.debut < b.debut ? -1 : 1; })
      .slice(0, 4);
    if (!avenir.length) return;
    conteneur.innerHTML = avenir.map(construireLigneEvenement).join("");
  }

  /* ---------- Actualités ---------- */
  function construireCarteActualite(a) {
    return '<article class="carte" data-type-evenement="' + echapperHtml(a.categorie) + '" data-anim>' +
      '<div class="carte-image"><img src="' + echapperHtml(a.image || "assets/img/histoire-01.svg") + '" alt="' + echapperHtml(a.categorie) + '"></div>' +
      '<div class="carte-corps"><span class="carte-etiquette">' + echapperHtml(a.categorie) + "</span>" +
      "<h3>" + echapperHtml(a.titre) + "</h3><p>" + echapperHtml(a.resume) + "</p>" +
      '<div class="carte-meta"><span>' + formaterPlageDate(a.date, a.date) + "</span></div></div></article>";
  }

  function actualiserActualites(liste) {
    var conteneur = $("#actualites-grille");
    if (!conteneur || !liste || !liste.length) return;
    liste = liste.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    conteneur.innerHTML = liste.map(construireCarteActualite).join("");
  }

  /* ---------- Galerie ---------- */
  function construireItemGalerie(g) {
    return '<div class="galerie-item" data-album="' + echapperHtml(g.album) + '" data-anim><img src="' + echapperHtml(g.image) + '" alt="' + echapperHtml(g.legende) + '"></div>';
  }

  function actualiserGalerie(liste) {
    var conteneur = $("#galerie-grille-auto");
    if (!conteneur || !liste || !liste.length) return;
    conteneur.innerHTML = liste.map(construireItemGalerie).join("");
  }

  /* ---------- Direction (portraits des responsables) ---------- */
  function construireCarteDirection(m) {
    var alt = m.fonction ? echapperHtml(m.nom) + ", " + echapperHtml(m.fonction) : echapperHtml(m.nom);
    var fonction = m.fonction ? '<p class="lead" style="margin-bottom:0;">' + echapperHtml(m.fonction) + "</p>" : "";
    return '<div style="display:flex; flex-direction:column; gap:18px;">' +
      '<div style="border-radius:var(--rayon-lg); overflow:hidden; box-shadow:var(--ombre); aspect-ratio:3/4;"><img src="' + echapperHtml(m.image) + '" alt="' + alt + '" style="width:100%; height:100%; object-fit:cover; object-position:top; display:block;"></div>' +
      "<div><h4 style=\"margin-bottom:2px;\">" + echapperHtml(m.nom) + "</h4>" + fonction + "</div></div>";
  }

  function actualiserDirection(liste) {
    var conteneurs = $$("[data-direction-auto]");
    if (!conteneurs.length || !liste || !liste.length) return;
    conteneurs.forEach(function (conteneur) {
      var groupe = conteneur.getAttribute("data-direction-auto");
      var membres = liste.filter(function (m) { return m.groupe === groupe; });
      if (membres.length) conteneur.innerHTML = membres.map(construireCarteDirection).join("");
    });
  }

  /* ---------- Orchestrateur : tente tous les chargements, attend le résultat ---------- */
  function chargerContenuDistant() {
    var etat = { evenementsChanges: false };
    var taches = [
      chargerJSON("content/coordonnees.json").then(function (d) {
        if (d) { Object.assign(CFG, d); injecterConfig(); initWhatsapp(); }
      }),
      chargerJSON("content/evenements.json").then(function (d) {
        if (d && d.length) { window.MIERR.evenements = d; etat.evenementsChanges = true; }
      }),
      chargerJSON("content/actualites.json").then(function (d) { if (d && d.length) actualiserActualites(d); }),
      chargerJSON("content/galerie.json").then(function (d) { if (d && d.length) actualiserGalerie(d); }),
      chargerJSON("content/direction.json").then(function (d) { if (d && d.length) actualiserDirection(d); })
    ];
    var attendreToutes = window.Promise && Promise.allSettled
      ? Promise.allSettled(taches)
      : Promise.all(taches.map(function (p) { return p.catch(function () {}); }));
    return attendreToutes.then(function () { return etat; });
  }

})();
