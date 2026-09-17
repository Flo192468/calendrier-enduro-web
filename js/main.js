(function () {
  "use strict";

  /* --------------------------------------------------------------------
     Randos : chargement des données et rendu (Accueil + Calendrier)
     -------------------------------------------------------------------- */
  var MONTH_ABBR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var MONTH_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  var STATUS_LABEL = { upcoming: "À venir", cancelled: "Annulée", past: "Passée" };

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
      '<a class="event-card" data-status="' + item.status + '" href="detail.html?id=' + encodeURIComponent(item.id) + '">' +
      '<div class="event-card__accent" aria-hidden="true"></div>' +
      '<div class="event-card__thumb">' +
      '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.imageAlt || "") + '" loading="lazy" />' +
      '</div>' +
      '<div class="event-card__body">' +
      '<h3 class="event-card__title">' + escapeHtml(item.title) + '</h3>' +
      '<p class="event-card__meta">' + escapeHtml(item.location) + ' (' + escapeHtml(item.dept) + ') · ' + formatDateLabel(item.date) + '</p>' +
      '<span class="badge">' + STATUS_LABEL[item.status] + '</span>' +
      '</div>' +
      '</a>' +
      '</li>'
    );
  }

  function groupSectionHTML(group) {
    var headingId = "group-" + group.key + (group.isPast ? "-past" : "");
    var title = group.isPast ? "Passées — " + group.label : group.label;
    return (
      '<section class="event-group" aria-labelledby="' + headingId + '">' +
      '<div class="event-group__header">' +
      '<span class="event-group__bar" aria-hidden="true"></span>' +
      '<h2 class="event-group__title" id="' + headingId + '">' + escapeHtml(title) + '</h2>' +
      '</div>' +
      '<ul class="event-list">' + group.items.map(cardHTML).join("") + '</ul>' +
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

  function fetchEvents() {
    return fetch("data/events.json").then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  /* ---- Accueil : "Prochaines randos" ---- */
  var homeList = document.querySelector("[data-home-list]");
  if (homeList) {
    fetchEvents()
      .then(function (data) {
        var upcoming = data
          .filter(function (item) { return item.status === "upcoming"; })
          .sort(byDateAsc)
          .slice(0, 3);
        homeList.innerHTML = upcoming.map(cardHTML).join("") ||
          '<li class="event-list__status">Aucune randonnée à venir pour le moment.</li>';
      })
      .catch(function () {
        homeList.innerHTML = '<li class="event-list__status">Impossible de charger les randonnées pour le moment.</li>';
      });
  }

  /* ---- Calendrier : liste complète + recherche + filtres ---- */
  var groupsWrap = document.querySelector("[data-event-groups]");
  if (groupsWrap) {
    var searchInput = document.querySelector("[data-search-input]");
    var resultsCount = document.querySelector("[data-results-count]");
    var emptyState = document.querySelector("[data-empty-state]");
    var dropdowns = Array.prototype.slice.call(document.querySelectorAll("[data-dropdown]"));

    var allEvents = [];
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
      var filtered = allEvents.filter(itemMatches);
      var upcoming = filtered.filter(function (i) { return i.status !== "past"; }).sort(byDateAsc);
      var past = filtered.filter(function (i) { return i.status === "past"; }).sort(byDateDesc);
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

      allEvents.forEach(function (item) {
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
      regions.sort(function (a, b) { return a.value.localeCompare(b.value, "fr"); });
      months.sort(function (a, b) { return a.value < b.value ? -1 : a.value > b.value ? 1 : 0; });

      var statuses = [
        { value: "upcoming", label: STATUS_LABEL.upcoming },
        { value: "cancelled", label: STATUS_LABEL.cancelled },
        { value: "past", label: STATUS_LABEL.past }
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

    fetchEvents()
      .then(function (data) {
        allEvents = data;
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
    var mapFilters = { status: "", region: "", query: "" };
    var mapEvents = [];
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
        '<a class="map-tooltip__link" href="detail.html?id=' + encodeURIComponent(item.id) + '">Voir la fiche ›</a>'
      );
    }

    function markerMatches(item) {
      if (mapFilters.status && item.status !== mapFilters.status) return false;
      if (mapFilters.region && item.location !== mapFilters.region) return false;
      if (mapFilters.query) {
        var haystack = normalize(item.title + " " + item.location + " " + item.dept);
        if (haystack.indexOf(normalize(mapFilters.query)) === -1) return false;
      }
      return true;
    }

    function renderMarkers() {
      mapMarkers.forEach(function (marker) { map.removeLayer(marker); });
      mapMarkers = [];

      var visible = mapEvents.filter(markerMatches).filter(function (item) {
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

    /* ---- Sidebar bureau : recherche + toggle de statut ---- */
    var mapSearchInput = document.querySelector("[data-map-search-input]");
    if (mapSearchInput) {
      mapSearchInput.addEventListener("input", function () {
        mapFilters.query = mapSearchInput.value.trim();
        renderMarkers();
      });
    }

    var statusToggle = document.querySelector("[data-status-toggle]");
    if (statusToggle) {
      var statusToggleBtns = Array.prototype.slice.call(statusToggle.querySelectorAll(".status-toggle__btn"));
      statusToggle.addEventListener("click", function (event) {
        var btn = event.target.closest(".status-toggle__btn");
        if (!btn) return;
        mapFilters.status = btn.getAttribute("data-status-value") || "";
        statusToggleBtns.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        renderMarkers();
      });
    }

    fetchEvents()
      .then(function (data) {
        mapEvents = data;

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
          regions.sort(function (a, b) { return a.value.localeCompare(b.value, "fr"); });
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
        mapEvents = [];
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

    fetchEvents()
      .then(function (data) {
        var item = data.filter(function (i) { return i.id === detailId; })[0];
        if (!item) {
          detailRoot.innerHTML = '<p class="detail-not-found">Randonnée introuvable. <a class="detail-link" href="calendar.html">Retour au calendrier</a></p>';
          return;
        }
        renderDetail(item);
      })
      .catch(function () {
        detailRoot.innerHTML = '<p class="detail-not-found">Impossible de charger cette randonnée pour le moment.</p>';
      });

    function contactMethodsFor(item) {
      var methods = [];
      if (item.contactPhone) {
        methods.push({
          href: "tel:" + item.contactPhone.replace(/\s+/g, ""),
          label: item.contactPhone,
          icon: "icon-phone",
          external: false
        });
      }
      if (item.contactEmail) {
        methods.push({
          href: "mailto:" + item.contactEmail + "?subject=" + encodeURIComponent("Réservation — " + item.title),
          label: item.contactEmail,
          icon: "icon-envelope",
          external: false
        });
      }
      if (item.contactFormUrl) {
        methods.push({
          href: item.contactFormUrl,
          label: "Formulaire de contact",
          icon: "icon-external-link",
          external: true
        });
      }
      return methods;
    }

    function ctaLinkAttrs(method) {
      return method.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    }

    // CTA fixe de la fiche : réservation en ligne si dispo, sinon contact organisateur,
    // sinon état non cliquable (cf. décision produit du 16/09/2026 — randonnée non "à venir" = CTA désactivé).
    function ctaHTML(item) {
      if (item.status !== "upcoming") {
        var closedLabel = item.status === "cancelled" ? "Randonnée annulée" : "Randonnée passée";
        return '<span class="detail-cta__button detail-cta__button--disabled" aria-disabled="true">' + closedLabel + '</span>';
      }

      if (item.reservationUrl) {
        return (
          '<a class="detail-cta__button" href="' + escapeHtml(item.reservationUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Réserver ma place (s’ouvre dans un nouvel onglet)">' +
          'Réserver ma place' +
          '<svg class="icon detail-cta__external-icon" aria-hidden="true"><use href="#icon-external-link"></use></svg>' +
          '</a>'
        );
      }

      var methods = contactMethodsFor(item);

      if (methods.length === 0) {
        return '<span class="detail-cta__button detail-cta__button--disabled" aria-disabled="true">Contact indisponible</span>';
      }

      if (methods.length === 1) {
        var method = methods[0];
        return '<a class="detail-cta__button" href="' + escapeHtml(method.href) + '"' + ctaLinkAttrs(method) + '>Contacter l’organisateur</a>';
      }

      var optionsHTML = methods.map(function (method) {
        return (
          '<a class="contact-choice__option" role="menuitem" href="' + escapeHtml(method.href) + '"' + ctaLinkAttrs(method) + '>' +
          '<svg class="icon" aria-hidden="true"><use href="#' + method.icon + '"></use></svg>' +
          escapeHtml(method.label) +
          '</a>'
        );
      }).join("");

      return (
        '<div class="detail-cta__wrap" data-contact-choice>' +
        '<button type="button" class="detail-cta__button" data-contact-choice-trigger aria-haspopup="true" aria-expanded="false">Contacter l’organisateur</button>' +
        '<div class="contact-choice__panel" data-contact-choice-panel role="menu" hidden>' + optionsHTML + '</div>' +
        '</div>'
      );
    }

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
        '<a class="detail-link" href="map.html">Voir sur la carte ›</a>' +
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
        '<footer class="site-footer">' +
        '<div class="site-footer__inner">' +
        '<p>© 2026 Calendrier Enduro</p>' +
        '<p class="site-footer__links">' +
        '<a href="#" aria-disabled="true" tabindex="-1">À propos <span class="sr-only">(bientôt disponible)</span></a>' +
        '<a href="#" aria-disabled="true" tabindex="-1">Contact <span class="sr-only">(bientôt disponible)</span></a>' +
        '</p>' +
        '</div>' +
        '</footer>' +
        '<div class="detail-cta">' + ctaHTML(item) + '</div>';

      var contactChoice = detailRoot.querySelector("[data-contact-choice]");
      if (contactChoice) {
        var contactTrigger = contactChoice.querySelector("[data-contact-choice-trigger]");
        var contactPanel = contactChoice.querySelector("[data-contact-choice-panel]");
        var contactOptions = Array.prototype.slice.call(contactPanel.querySelectorAll(".contact-choice__option"));

        var closeContactPanel = function () {
          contactPanel.hidden = true;
          contactTrigger.setAttribute("aria-expanded", "false");
        };

        contactTrigger.addEventListener("click", function () {
          var isHidden = contactPanel.hidden;
          contactPanel.hidden = !isHidden;
          contactTrigger.setAttribute("aria-expanded", isHidden ? "true" : "false");
          if (isHidden && contactOptions[0]) contactOptions[0].focus();
        });

        contactPanel.addEventListener("keydown", function (event) {
          if (event.key === "Escape") {
            closeContactPanel();
            contactTrigger.focus();
          }
        });

        document.addEventListener("click", function (event) {
          if (!contactChoice.contains(event.target)) closeContactPanel();
        });
      }

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

  /* --------------------------------------------------------------------
     Proposer une randonnée (submit.html) : validation accessible + envoi (Formspree)
     -------------------------------------------------------------------- */
  var submitForm = document.querySelector("[data-submit-form]");
  if (submitForm) {
    var submitStatus = submitForm.querySelector("[data-submit-status]");
    var submitButton = submitForm.querySelector("[data-submit-button]");
    var phoneInput = submitForm.querySelector("#organizer-phone");
    var emailInput = submitForm.querySelector("#organizer-email");
    var contactError = submitForm.querySelector("#organizer-contact-error");

    var VALIDITY_MESSAGES = {
      valueMissing: "Ce champ est obligatoire.",
      typeMismatch_email: "Format d'email invalide (ex. nom@exemple.fr).",
      typeMismatch_url: "Lien invalide (doit commencer par http:// ou https://).",
      typeMismatch_tel: "Format de téléphone invalide."
    };

    function fieldErrorMessage(field) {
      var validity = field.validity;
      if (validity.valueMissing) return VALIDITY_MESSAGES.valueMissing;
      if (validity.typeMismatch) return VALIDITY_MESSAGES["typeMismatch_" + field.type] || "Format invalide.";
      return field.validationMessage || "Champ invalide.";
    }

    function setFieldError(field, message) {
      var errorEl = submitForm.querySelector('[data-error-for="' + field.id + '"]');
      if (errorEl) errorEl.textContent = message || "";
      field.setAttribute("aria-invalid", message ? "true" : "false");
    }

    function clearAllErrors() {
      var errors = submitForm.querySelectorAll(".form-field__error");
      for (var i = 0; i < errors.length; i++) errors[i].textContent = "";
      var fields = submitForm.querySelectorAll("[aria-invalid]");
      for (var j = 0; j < fields.length; j++) fields[j].setAttribute("aria-invalid", "false");
    }

    function showStatus(kind, message) {
      submitStatus.hidden = false;
      submitStatus.className = "form-status form-status--" + kind;
      submitStatus.setAttribute("role", kind === "error" ? "alert" : "status");
      var iconId = kind === "error" ? "icon-alert-circle" : "icon-check-circle";
      submitStatus.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#' + iconId + '"></use></svg>' +
        "<span>" + escapeHtml(message) + "</span>";
    }

    submitForm.addEventListener("submit", function (event) {
      event.preventDefault();
      clearAllErrors();
      submitStatus.hidden = true;

      var firstInvalid = null;
      var fields = Array.prototype.slice.call(
        submitForm.querySelectorAll("input:not([name='_gotcha']), textarea")
      );
      fields.forEach(function (field) {
        if (!field.checkValidity()) {
          setFieldError(field, fieldErrorMessage(field));
          if (!firstInvalid) firstInvalid = field;
        }
      });

      var hasContact = phoneInput.value.trim() !== "" || emailInput.value.trim() !== "";
      if (!hasContact) {
        contactError.textContent = "Renseignez au moins un moyen de contact (téléphone ou email).";
        phoneInput.setAttribute("aria-invalid", "true");
        emailInput.setAttribute("aria-invalid", "true");
        if (!firstInvalid) firstInvalid = phoneInput;
      }

      if (firstInvalid) {
        showStatus("error", "Merci de corriger les champs signalés ci-dessous.");
        firstInvalid.focus();
        return;
      }

      var honeypot = submitForm.querySelector('[name="_gotcha"]');
      if (honeypot && honeypot.value) return; // bot détecté : on n'envoie rien, silencieusement

      submitButton.disabled = true;
      fetch(submitForm.action, {
        method: "POST",
        body: new FormData(submitForm),
        headers: { Accept: "application/json" }
      })
        .then(function (response) {
          submitButton.disabled = false;
          if (response.ok) {
            showStatus("success", "Merci ! Votre proposition a bien été envoyée, nous la publierons après vérification.");
            submitForm.reset();
          } else {
            showStatus("error", "L'envoi a échoué. Réessayez, ou contactez-nous directement.");
          }
        })
        .catch(function () {
          submitButton.disabled = false;
          showStatus("error", "L'envoi a échoué (connexion). Réessayez, ou contactez-nous directement.");
        });
    });
  }
})();
