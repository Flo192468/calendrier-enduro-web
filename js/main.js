(function () {
  "use strict";

  /* --------------------------------------------------------------------
     Menu mobile (panneau latéral)
     -------------------------------------------------------------------- */
  var menuToggle = document.querySelector("[data-menu-toggle]");
  var menu = document.getElementById("mobile-menu");

  function openMenu() {
    if (!menu) return;
    menu.dataset.open = "true";
    menuToggle.setAttribute("aria-expanded", "true");
    var firstLink = menu.querySelector(".mobile-menu__link, .mobile-menu__close");
    if (firstLink) firstLink.focus();
    document.addEventListener("keydown", onMenuKeydown);
  }

  function closeMenu() {
    if (!menu) return;
    menu.dataset.open = "false";
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.focus();
    document.removeEventListener("keydown", onMenuKeydown);
  }

  function onMenuKeydown(event) {
    if (event.key === "Escape") {
      closeMenu();
    }
  }

  if (menuToggle && menu) {
    menuToggle.addEventListener("click", function () {
      var isOpen = menu.dataset.open === "true";
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    menu.querySelectorAll("[data-menu-close]").forEach(function (el) {
      el.addEventListener("click", closeMenu);
    });
  }

  /* --------------------------------------------------------------------
     Randos : chargement des données et rendu (Accueil + Calendrier)
     -------------------------------------------------------------------- */
  var MONTH_ABBR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var MONTH_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  var STATUS_LABEL = { venir: "À venir", annulee: "Annulée", passee: "Passée" };

  function parseDateParts(isoDate) {
    var parts = isoDate.split("-");
    return { year: parts[0], monthIndex: Number(parts[1]) - 1, day: parts[2] };
  }

  function formatDateLabel(isoDate) {
    var d = parseDateParts(isoDate);
    return d.day + " " + MONTH_ABBR[d.monthIndex] + " " + d.year;
  }

  function monthKey(isoDate) {
    return isoDate.slice(0, 7);
  }

  function monthLabel(isoDate) {
    var d = parseDateParts(isoDate);
    return MONTH_FULL[d.monthIndex] + " " + d.year;
  }

  function normalize(str) {
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function cardHTML(item) {
    return (
      '<li>' +
      '<a class="rando-card" data-status="' + item.status + '" href="fiche.html?id=' + encodeURIComponent(item.id) + '">' +
      '<div class="rando-card__accent" aria-hidden="true"></div>' +
      '<div class="rando-card__thumb">' +
      '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.imageAlt || "") + '" loading="lazy" />' +
      '</div>' +
      '<div class="rando-card__body">' +
      '<h3 class="rando-card__title">' + escapeHtml(item.title) + '</h3>' +
      '<p class="rando-card__meta">' + escapeHtml(item.location) + ' (' + escapeHtml(item.dept) + ') · ' + formatDateLabel(item.date) + '</p>' +
      '<span class="badge">' + STATUS_LABEL[item.status] + '</span>' +
      '</div>' +
      '</a>' +
      '</li>'
    );
  }

  function groupSectionHTML(group) {
    var headingId = "groupe-" + group.key + (group.isPast ? "-passees" : "");
    var title = group.isPast ? "Passées — " + group.label : group.label;
    return (
      '<section class="rando-group" aria-labelledby="' + headingId + '">' +
      '<div class="rando-group__header">' +
      '<span class="rando-group__bar" aria-hidden="true"></span>' +
      '<h2 class="rando-group__title" id="' + headingId + '">' + escapeHtml(title) + '</h2>' +
      '</div>' +
      '<ul class="rando-list">' + group.items.map(cardHTML).join("") + '</ul>' +
      '</section>'
    );
  }

  // Regroupe une liste déjà triée en blocs par mois consécutifs.
  function groupByMonth(items, isPast) {
    var groups = [];
    var current = null;
    items.forEach(function (item) {
      var key = monthKey(item.date);
      if (!current || current.key !== key) {
        current = { key: key, label: monthLabel(item.date), isPast: isPast, items: [] };
        groups.push(current);
      }
      current.items.push(item);
    });
    return groups;
  }

  function byDateAsc(a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  }

  function byDateDesc(a, b) {
    return -byDateAsc(a, b);
  }

  function fetchRandos() {
    return fetch("data/randos.json").then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  /* ---- Accueil : "Prochaines randos" ---- */
  var homeList = document.querySelector("[data-home-list]");
  if (homeList) {
    fetchRandos()
      .then(function (data) {
        var upcoming = data
          .filter(function (item) { return item.status === "venir"; })
          .sort(byDateAsc)
          .slice(0, 3);
        homeList.innerHTML = upcoming.map(cardHTML).join("") ||
          '<li class="rando-list__status">Aucune randonnée à venir pour le moment.</li>';
      })
      .catch(function () {
        homeList.innerHTML = '<li class="rando-list__status">Impossible de charger les randonnées pour le moment.</li>';
      });
  }

  /* ---- Calendrier : liste complète + recherche + filtres ---- */
  var groupsWrap = document.querySelector("[data-rando-groups]");
  if (groupsWrap) {
    var searchInput = document.querySelector("[data-search-input]");
    var resultsCount = document.querySelector("[data-results-count]");
    var emptyState = document.querySelector("[data-empty-state]");
    var dropdowns = Array.prototype.slice.call(document.querySelectorAll("[data-dropdown]"));

    var allRandos = [];
    var filters = { query: "", region: "", month: "", status: "" };

    var params = new URLSearchParams(window.location.search);
    if (params.get("q")) {
      filters.query = params.get("q");
    }

    function itemMatches(item) {
      if (filters.region && item.location !== filters.region) return false;
      if (filters.month && monthKey(item.date) !== filters.month) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.query) {
        var haystack = normalize(item.title + " " + item.location + " " + item.dept + " " + formatDateLabel(item.date));
        if (haystack.indexOf(normalize(filters.query)) === -1) return false;
      }
      return true;
    }

    function render() {
      var filtered = allRandos.filter(itemMatches);
      var upcoming = filtered.filter(function (i) { return i.status !== "passee"; }).sort(byDateAsc);
      var past = filtered.filter(function (i) { return i.status === "passee"; }).sort(byDateDesc);
      var groups = groupByMonth(upcoming, false).concat(groupByMonth(past, true));

      groupsWrap.innerHTML = groups.map(groupSectionHTML).join("");

      if (resultsCount) {
        if (filtered.length === 0) {
          resultsCount.textContent = "0 randonnée";
        } else {
          resultsCount.textContent =
            filtered.length + (filtered.length > 1 ? " randonnées" : " randonnée") +
            " · " + upcoming.length + " à venir, " + past.length + " passée" + (past.length > 1 ? "s" : "");
        }
      }

      if (emptyState) {
        emptyState.dataset.visible = filtered.length === 0 ? "true" : "false";
      }
    }

    /* ---- Dropdowns de filtre (Département / Date / Statut) ---- */
    function closeAllDropdowns(except) {
      dropdowns.forEach(function (dd) {
        if (dd === except) return;
        var btn = dd.querySelector("[data-filter-chip]");
        var panel = dd.querySelector("[data-dropdown-panel]");
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
      });
    }

    function setupDropdown(dd) {
      var key = dd.getAttribute("data-dropdown"); // "region" | "month" | "status"
      var btn = dd.querySelector("[data-filter-chip]");
      var panel = dd.querySelector("[data-dropdown-panel]");

      function renderOptions(defaultLabel, options) {
        var current = filters[key];
        var html = '<button type="button" class="dropdown__option" role="option" data-value="" aria-selected="' +
          (current === "" ? "true" : "false") + '">' + escapeHtml(defaultLabel) + '</button>';
        options.forEach(function (opt) {
          html += '<button type="button" class="dropdown__option" role="option" data-value="' + escapeHtml(opt.value) + '" aria-selected="' +
            (current === opt.value ? "true" : "false") + '">' + escapeHtml(opt.label) + '</button>';
        });
        panel.innerHTML = html;
      }

      panel.addEventListener("click", function (event) {
        var option = event.target.closest(".dropdown__option");
        if (!option) return;
        filters[key] = option.getAttribute("data-value") || "";
        btn.setAttribute("aria-pressed", filters[key] ? "true" : "false");
        closeAllDropdowns();
        btn.setAttribute("aria-expanded", "false");
        render();
      });

      btn.addEventListener("click", function () {
        var isOpen = !panel.hidden;
        closeAllDropdowns(dd);
        panel.hidden = isOpen;
        btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
      });

      return { key: key, renderOptions: renderOptions };
    }

    var dropdownControllers = dropdowns.map(setupDropdown);

    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-dropdown]")) closeAllDropdowns();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeAllDropdowns();
    });

    function populateDropdownOptions() {
      var regions = [];
      var seenRegion = {};
      var months = [];
      var seenMonth = {};

      allRandos.forEach(function (item) {
        if (!seenRegion[item.location]) {
          seenRegion[item.location] = true;
          regions.push({ value: item.location, label: item.location + " (" + item.dept + ")" });
        }
        var mk = monthKey(item.date);
        if (!seenMonth[mk]) {
          seenMonth[mk] = true;
          months.push({ value: mk, label: monthLabel(item.date) });
        }
      });
      months.sort(function (a, b) { return a.value < b.value ? -1 : a.value > b.value ? 1 : 0; });

      var statuses = [
        { value: "venir", label: STATUS_LABEL.venir },
        { value: "annulee", label: STATUS_LABEL.annulee },
        { value: "passee", label: STATUS_LABEL.passee }
      ];

      dropdownControllers.forEach(function (ctrl) {
        if (ctrl.key === "region") ctrl.renderOptions("Tous les départements", regions);
        if (ctrl.key === "month") ctrl.renderOptions("Toutes les dates", months);
        if (ctrl.key === "status") ctrl.renderOptions("Tous les statuts", statuses);
      });
    }

    if (searchInput) {
      searchInput.value = filters.query;
      searchInput.addEventListener("input", function () {
        filters.query = searchInput.value.trim();
        render();
      });
    }

    fetchRandos()
      .then(function (data) {
        allRandos = data;
        populateDropdownOptions();
        render();
      })
      .catch(function () {
        if (resultsCount) resultsCount.textContent = "Impossible de charger les randonnées.";
      });
  }

  /* --------------------------------------------------------------------
     Carte : vraie carte (Leaflet + fond OpenStreetMap)
     -------------------------------------------------------------------- */
  var mapPlaceholder = document.querySelector("[data-map-placeholder]");
  if (mapPlaceholder && window.L) {
    var leafletMapEl = mapPlaceholder.querySelector("[data-leaflet-map]");
    var mapDropdowns = Array.prototype.slice.call(document.querySelectorAll(".map-filters [data-dropdown]"));
    var mapFilters = { status: "", region: "" };
    var mapRandos = [];
    var mapMarkers = [];

    var map = L.map(leafletMapEl, { scrollWheelZoom: false }).setView([46.6, 2.4], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    function pinIcon(status) {
      return L.divIcon({
        className: "",
        html: '<svg class="icon icon--fill map-marker-icon" data-status="' + status + '" aria-hidden="true"><use href="#icon-location-pin"></use></svg>',
        iconSize: [28, 40],
        iconAnchor: [14, 40],
        popupAnchor: [0, -34]
      });
    }

    function popupHTML(item) {
      return (
        '<div class="map-tooltip__title">' + escapeHtml(item.title) + '</div>' +
        '<div class="map-tooltip__date">' + formatDateLabel(item.date) + '</div>' +
        '<a class="map-tooltip__link" href="fiche.html?id=' + encodeURIComponent(item.id) + '">Voir la fiche ›</a>'
      );
    }

    function markerMatches(item) {
      if (mapFilters.status && item.status !== mapFilters.status) return false;
      if (mapFilters.region && item.location !== mapFilters.region) return false;
      return true;
    }

    function renderMarkers() {
      mapMarkers.forEach(function (marker) { map.removeLayer(marker); });
      mapMarkers = [];

      var visible = mapRandos.filter(markerMatches).filter(function (item) {
        return item.lat != null && item.lng != null;
      });

      visible.forEach(function (item) {
        var marker = L.marker([item.lat, item.lng], { icon: pinIcon(item.status), title: item.title });
        marker.bindPopup(popupHTML(item));
        marker.addTo(map);
        mapMarkers.push(marker);
      });

      if (visible.length) {
        var bounds = L.latLngBounds(visible.map(function (item) { return [item.lat, item.lng]; }));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
      }
    }

    function closeAllMapDropdowns(except) {
      mapDropdowns.forEach(function (dd) {
        if (dd === except) return;
        var otherPanel = dd.querySelector("[data-dropdown-panel]");
        var otherBtn = dd.querySelector("[data-filter-chip]");
        otherPanel.hidden = true;
        otherBtn.setAttribute("aria-expanded", "false");
      });
    }

    function setupMapDropdown(dd) {
      var key = dd.getAttribute("data-dropdown"); // "region" | "status"
      var btn = dd.querySelector("[data-filter-chip]");
      var panel = dd.querySelector("[data-dropdown-panel]");

      panel.addEventListener("click", function (event) {
        var option = event.target.closest(".dropdown__option");
        if (!option) return;
        mapFilters[key] = option.getAttribute("data-value") || "";
        panel.querySelectorAll(".dropdown__option").forEach(function (o) {
          o.setAttribute("aria-selected", o === option ? "true" : "false");
        });
        btn.setAttribute("aria-pressed", mapFilters[key] ? "true" : "false");
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        renderMarkers();
      });

      btn.addEventListener("click", function () {
        var isOpen = !panel.hidden;
        closeAllMapDropdowns(dd);
        panel.hidden = isOpen;
        btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
      });
    }

    mapDropdowns.forEach(setupMapDropdown);

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".map-filters [data-dropdown]")) closeAllMapDropdowns();
    });

    fetchRandos()
      .then(function (data) {
        mapRandos = data;

        var regionDropdown = document.querySelector('.map-filters [data-dropdown="region"]');
        if (regionDropdown) {
          var regions = [];
          var seen = {};
          data.forEach(function (item) {
            if (!seen[item.location]) {
              seen[item.location] = true;
              regions.push({ value: item.location, label: item.location + " (" + item.dept + ")" });
            }
          });
          var panel = regionDropdown.querySelector("[data-dropdown-panel]");
          var html = '<button type="button" class="dropdown__option" role="option" data-value="" aria-selected="true">Tous les départements</button>';
          regions.forEach(function (opt) {
            html += '<button type="button" class="dropdown__option" role="option" data-value="' + escapeHtml(opt.value) + '" aria-selected="false">' + escapeHtml(opt.label) + '</button>';
          });
          panel.innerHTML = html;
        }

        renderMarkers();
      })
      .catch(function () {
        mapRandos = [];
      });

    var locateBtn = document.querySelector("[data-map-locate]");
    var userLocationMarker = null;
    if (locateBtn && "geolocation" in navigator) {
      locateBtn.addEventListener("click", function () {
        locateBtn.setAttribute("aria-pressed", "true");
        navigator.geolocation.getCurrentPosition(
          function (position) {
            locateBtn.setAttribute("aria-pressed", "false");
            var latlng = [position.coords.latitude, position.coords.longitude];
            if (userLocationMarker) map.removeLayer(userLocationMarker);
            userLocationMarker = L.circleMarker(latlng, {
              radius: 8,
              color: "#fff",
              weight: 3,
              fillColor: "#1a73e8",
              fillOpacity: 1
            }).addTo(map);
            map.setView(latlng, 11);
          },
          function () {
            locateBtn.setAttribute("aria-pressed", "false");
            locateBtn.setAttribute("title", "Géolocalisation indisponible");
          }
        );
      });
    } else if (locateBtn) {
      locateBtn.disabled = true;
    }
  }

  /* --------------------------------------------------------------------
     Fiche : détail d'une randonnée (lecture du paramètre ?id=)
     -------------------------------------------------------------------- */
  var detailRoot = document.querySelector("[data-detail-root]");
  if (detailRoot) {
    var detailId = new URLSearchParams(window.location.search).get("id");

    fetchRandos()
      .then(function (data) {
        var item = data.filter(function (i) { return i.id === detailId; })[0];
        if (!item) {
          detailRoot.innerHTML = '<p class="detail-not-found">Randonnée introuvable. <a class="detail-link" href="calendrier.html">Retour au calendrier</a></p>';
          return;
        }
        renderDetail(item);
      })
      .catch(function () {
        detailRoot.innerHTML = '<p class="detail-not-found">Impossible de charger cette randonnée pour le moment.</p>';
      });

    function renderDetail(item) {
      document.title = item.title + " — Calendrier Enduro";

      detailRoot.innerHTML =
        '<div class="detail-hero" data-status="' + item.status + '">' +
        '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.imageAlt || "") + '" />' +
        '<span class="badge">' + STATUS_LABEL[item.status] + '</span>' +
        '</div>' +
        '<div class="detail-title-meta">' +
        '<h1>' + escapeHtml(item.title) + '</h1>' +
        '<p class="detail-meta-row"><svg class="icon" aria-hidden="true"><use href="#icon-location-dot"></use></svg>' +
        escapeHtml(item.location) + ' (' + escapeHtml(item.dept) + ') · ' + formatDateLabel(item.date) + (item.time ? ' · ' + escapeHtml(item.time) : '') +
        '</p>' +
        '</div>' +
        '<div class="detail-stats">' +
        '<div class="detail-stat"><svg class="icon" aria-hidden="true"><use href="#icon-route"></use></svg>' +
        '<span class="detail-stat__label">Distance</span><span class="detail-stat__value">' + (item.distanceKm ? item.distanceKm + ' km' : '—') + '</span></div>' +
        '<div class="detail-stat"><svg class="icon" aria-hidden="true"><use href="#icon-money-bill"></use></svg>' +
        '<span class="detail-stat__label">Tarif</span><span class="detail-stat__value">' + (item.price != null ? item.price + ' €' : '—') + '</span></div>' +
        '<div class="detail-stat"><svg class="icon" aria-hidden="true"><use href="#icon-repeat"></use></svg>' +
        '<span class="detail-stat__label">Nombre de boucles</span><span class="detail-stat__value">' + (item.loops ? item.loops + (item.loops > 1 ? ' boucles' : ' boucle') : '—') + '</span></div>' +
        '</div>' +
        '<div class="detail-section">' +
        '<h2>Lieu de rendez-vous</h2>' +
        '<p class="detail-meeting-row"><svg class="icon" aria-hidden="true"><use href="#icon-location-dot"></use></svg><span>' + escapeHtml(item.meetingPoint || "Communiqué ultérieurement") + '</span></p>' +
        '<div class="mini-map" data-mini-map></div>' +
        '<a class="detail-link" href="carte.html">Voir sur la carte ›</a>' +
        '</div>' +
        (item.organizerName ?
          '<div class="detail-section">' +
          '<h2>L’organisateur</h2>' +
          '<p class="detail-organizer__name">' + escapeHtml(item.organizerName) + '</p>' +
          '<p class="detail-organizer__desc">' + escapeHtml(item.organizerDescription || "") + '</p>' +
          '</div>' : '') +
        '<div class="detail-section" style="padding-bottom: var(--space-5);">' +
        '<h2>Réserver / contacter l’organisateur</h2>' +
        '<div class="contact-list">' +
        (item.contactPhone ?
          '<a class="contact-list__row" href="tel:' + escapeHtml(item.contactPhone.replace(/\s+/g, "")) + '">' +
          '<svg class="icon" aria-hidden="true"><use href="#icon-phone"></use></svg>' + escapeHtml(item.contactPhone) + '</a>' : '') +
        (item.contactEmail ?
          '<a class="contact-list__row" href="mailto:' + escapeHtml(item.contactEmail) + '">' +
          '<svg class="icon" aria-hidden="true"><use href="#icon-envelope"></use></svg>' + escapeHtml(item.contactEmail) + '</a>' : '') +
        '</div>' +
        '</div>' +
        '<div class="detail-cta">' +
        (item.contactEmail ?
          '<a class="detail-cta__button" href="mailto:' + escapeHtml(item.contactEmail) + '?subject=' + encodeURIComponent("Réservation — " + item.title) + '">Réserver ma place</a>' :
          '<span class="detail-cta__button">Réserver ma place</span>') +
        '</div>';

      var miniMapEl = detailRoot.querySelector("[data-mini-map]");
      if (miniMapEl && window.L && item.lat != null && item.lng != null) {
        var miniMap = L.map(miniMapEl, {
          zoomControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          boxZoom: false,
          keyboard: false
        }).setView([item.lat, item.lng], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(miniMap);
        L.marker([item.lat, item.lng], {
          icon: L.divIcon({
            className: "",
            html: '<svg class="icon icon--fill map-marker-icon" aria-hidden="true"><use href="#icon-location-pin"></use></svg>',
            iconSize: [26, 37],
            iconAnchor: [13, 37]
          })
        }).addTo(miniMap);
      }
    }

    var backBtn = document.querySelector("[data-detail-back]");
    if (backBtn) {
      backBtn.addEventListener("click", function (event) {
        if (window.history.length > 1 && document.referrer) {
          event.preventDefault();
          window.history.back();
        }
      });
    }
  }
})();
