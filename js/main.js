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

  // Départements métropolitains, regroupés par région (utilisés pour les libellés
  // de filtre et pour que la recherche trouve "Provence", "Isère", "Occitanie"…).
  var REGIONS = {
    "Auvergne-Rhône-Alpes": "01:Ain,03:Allier,07:Ardèche,15:Cantal,26:Drôme,38:Isère,42:Loire,43:Haute-Loire,63:Puy-de-Dôme,69:Rhône,73:Savoie,74:Haute-Savoie",
    "Bourgogne-Franche-Comté": "21:Côte-d'Or,25:Doubs,39:Jura,58:Nièvre,70:Haute-Saône,71:Saône-et-Loire,89:Yonne,90:Territoire de Belfort",
    "Bretagne": "22:Côtes-d'Armor,29:Finistère,35:Ille-et-Vilaine,56:Morbihan",
    "Centre-Val de Loire": "18:Cher,28:Eure-et-Loir,36:Indre,37:Indre-et-Loire,41:Loir-et-Cher,45:Loiret",
    "Corse": "2A:Corse-du-Sud,2B:Haute-Corse",
    "Grand Est": "08:Ardennes,10:Aube,51:Marne,52:Haute-Marne,54:Meurthe-et-Moselle,55:Meuse,57:Moselle,67:Bas-Rhin,68:Haut-Rhin,88:Vosges",
    "Hauts-de-France": "02:Aisne,59:Nord,60:Oise,62:Pas-de-Calais,80:Somme",
    "Île-de-France": "75:Paris,77:Seine-et-Marne,78:Yvelines,91:Essonne,92:Hauts-de-Seine,93:Seine-Saint-Denis,94:Val-de-Marne,95:Val-d'Oise",
    "Normandie": "14:Calvados,27:Eure,50:Manche,61:Orne,76:Seine-Maritime",
    "Nouvelle-Aquitaine": "16:Charente,17:Charente-Maritime,19:Corrèze,23:Creuse,24:Dordogne,33:Gironde,40:Landes,47:Lot-et-Garonne,64:Pyrénées-Atlantiques,79:Deux-Sèvres,86:Vienne,87:Haute-Vienne",
    "Occitanie": "09:Ariège,11:Aude,12:Aveyron,30:Gard,31:Haute-Garonne,32:Gers,34:Hérault,46:Lot,48:Lozère,65:Hautes-Pyrénées,66:Pyrénées-Orientales,81:Tarn,82:Tarn-et-Garonne",
    "Pays de la Loire": "44:Loire-Atlantique,49:Maine-et-Loire,53:Mayenne,72:Sarthe,85:Vendée",
    "Provence-Alpes-Côte d'Azur": "04:Alpes-de-Haute-Provence,05:Hautes-Alpes,06:Alpes-Maritimes,13:Bouches-du-Rhône,83:Var,84:Vaucluse"
  };

  var DEPARTMENTS = {};
  Object.keys(REGIONS).forEach(function (region) {
    REGIONS[region].split(",").forEach(function (entry) {
      var parts = entry.split(":");
      DEPARTMENTS[parts[0]] = { name: parts[1], region: region };
    });
  });

  function deptLabel(code) {
    var dept = DEPARTMENTS[code];
    return dept ? dept.name + " (" + code + ")" : code;
  }

  // Minuscules, sans accents ; tirets et apostrophes deviennent des espaces
  // pour que "haute provence" trouve "Alpes-de-Haute-Provence".
  function normalize(str) {
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[-'’]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Recherche plein texte : nom, lieu, département (numéro et nom), région, date.
  function matchesQuery(item, query) {
    var dept = DEPARTMENTS[item.dept] || {};
    var haystack = normalize([
      item.title, item.location, item.dept, dept.name || "", dept.region || "", formatDateLabel(item.date)
    ].join(" "));
    return haystack.indexOf(normalize(query)) !== -1;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // v1.1 « Événements sans visuels » : les champs image / imageAlt de data/events.json
  // sont conservés mais plus affichés (ni vignette de carte, ni hero de fiche).
  var MONTH_SHORT_FORMAT = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
  var FULL_DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  function toUtcDate(isoDate) {
    var d = parseDateParts(isoDate);
    return new Date(Date.UTC(Number(d.year), d.monthIndex, Number(d.day)));
  }

  // Bloc date : jour / mois abrégé (sans point, majuscules en CSS) / année.
  // Le lecteur d'écran lit uniquement la date complète en texte masqué.
  function dateBlockHTML(item) {
    var d = parseDateParts(item.date);
    var date = toUtcDate(item.date);
    return (
      '<time class="event-card__date" datetime="' + escapeHtml(item.date) + '">' +
      '<span class="event-card__day" aria-hidden="true">' + Number(d.day) + '</span>' +
      '<span class="event-card__month" aria-hidden="true">' + MONTH_SHORT_FORMAT.format(date).replace(/\.$/, "") + '</span>' +
      '<span class="event-card__year" aria-hidden="true">' + d.year + '</span>' +
      '<span class="sr-only">' + FULL_DATE_FORMAT.format(date) + '</span>' +
      '</time>'
    );
  }

  // Un seul lien par carte (sur le titre), étendu à toute la carte en CSS.
  // « Voir la fiche › » n'est qu'un indice visuel de la liste bureau.
  function cardHTML(item) {
    return (
      '<li class="event-card" data-status="' + item.status + '">' +
      '<div class="event-card__accent" aria-hidden="true"></div>' +
      dateBlockHTML(item) +
      '<div class="event-card__body">' +
      '<h3 class="event-card__title"><a class="event-card__link" href="detail.html?id=' + encodeURIComponent(item.id) + '">' + escapeHtml(item.title) + '</a></h3>' +
      '<p class="event-card__meta">' + escapeHtml(item.location) + ' (' + escapeHtml(item.dept) + ')</p>' +
      '<p class="event-card__status"><span class="badge">' + STATUS_LABEL[item.status] + '</span></p>' +
      '<span class="event-card__action" aria-hidden="true">Voir la fiche ›</span>' +
      '</div>' +
      '</li>'
    );
  }

  function groupSectionHTML(group) {
    var headingId = "group-" + group.key + (group.isPast ? "-past" : "");
    var title = group.isPast ? "Passées — " + group.label : group.label;
    return (
      '<section class="event-group' + (group.isPast ? ' event-group--past' : '') + '" aria-labelledby="' + headingId + '">' +
      '<div class="event-group__header">' +
      '<span class="event-group__bar" aria-hidden="true"></span>' +
      '<h2 class="event-group__title" id="' + headingId + '">' + escapeHtml(title) + '</h2>' +
      '</div>' +
      // En-tête de colonnes de la liste bureau : décoratif, chaque ligne porte déjà son contenu.
      '<div class="event-list__columns" aria-hidden="true"><span></span><span>Date</span><span>Randonnée</span><span>Lieu</span><span>Statut</span><span></span></div>' +
      '<ol class="event-list event-list--rows">' + group.items.map(cardHTML).join("") + '</ol>' +
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

  /* ---- Options de filtre, dérivées des données ---- */
  function deptOptions(events) {
    var seen = {};
    return events
      .filter(function (item) {
        if (seen[item.dept]) return false;
        seen[item.dept] = true;
        return true;
      })
      .map(function (item) { return { value: item.dept, label: deptLabel(item.dept) }; })
      .sort(function (a, b) { return a.value < b.value ? -1 : a.value > b.value ? 1 : 0; });
  }

  function monthOptions(events) {
    var seen = {};
    return events
      .filter(function (item) {
        var mk = monthKey(item.date);
        if (seen[mk]) return false;
        seen[mk] = true;
        return true;
      })
      .map(function (item) { return { value: monthKey(item.date), label: monthLabel(item.date) }; })
      .sort(function (a, b) { return a.value < b.value ? -1 : a.value > b.value ? 1 : 0; });
  }

  function statusOptions() {
    return ["upcoming", "cancelled", "past"].map(function (value) {
      return { value: value, label: STATUS_LABEL[value] };
    });
  }

  /* ---- Filtres <-> URL (liens partageables, état conservé au retour arrière) ---- */
  var URL_PARAMS = { query: "q", dept: "dept", month: "mois", status: "statut" };

  function readUrlFilters(filters) {
    var params = new URLSearchParams(window.location.search);
    Object.keys(filters).forEach(function (key) {
      filters[key] = (params.get(URL_PARAMS[key]) || "").trim();
    });
    return filters;
  }

  function writeUrlFilters(filters) {
    var params = new URLSearchParams();
    Object.keys(filters).forEach(function (key) {
      if (filters[key]) params.set(URL_PARAMS[key], filters[key]);
    });
    var qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
  }

  function hasActiveFilters(filters) {
    return Object.keys(filters).some(function (key) { return !!filters[key]; });
  }

  /* ---- Liste déroulante de filtre (chip + listbox), partagée Calendrier / Carte ---- */
  var dropdownRegistry = [];

  function createDropdown(root, onChange) {
    var btn = root.querySelector("[data-filter-chip]");
    var panel = root.querySelector("[data-dropdown-panel]");
    var labelEl = btn.querySelector("[data-chip-label]");
    var name = labelEl.textContent.trim();
    var allLabel = name;
    var options = [];
    var value = "";

    panel.id = "dropdown-" + root.getAttribute("data-dropdown");
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-controls", panel.id);

    function optionEls() {
      return Array.prototype.slice.call(panel.querySelectorAll(".dropdown__option"));
    }

    function currentOption() {
      return options.filter(function (opt) { return opt.value === value; })[0];
    }

    function renderOptions() {
      panel.innerHTML = [{ value: "", label: allLabel }].concat(options).map(function (opt) {
        return '<button type="button" class="dropdown__option" role="option" tabindex="-1" data-value="' + escapeHtml(opt.value) +
          '" aria-selected="' + (opt.value === value ? "true" : "false") + '">' + escapeHtml(opt.label) + '</button>';
      }).join("");
    }

    function renderChip() {
      var current = currentOption();
      btn.setAttribute("aria-pressed", current ? "true" : "false");
      labelEl.innerHTML = current
        ? '<span class="sr-only">' + escapeHtml(name) + ' : </span>' + escapeHtml(current.label)
        : escapeHtml(name);
    }

    // Une valeur absente des options (URL modifiée à la main, donnée disparue) est ignorée.
    function setValue(newValue) {
      value = options.some(function (opt) { return opt.value === newValue; }) ? newValue : "";
      optionEls().forEach(function (el) {
        el.setAttribute("aria-selected", el.getAttribute("data-value") === value ? "true" : "false");
      });
      renderChip();
      return value;
    }

    function setOptions(newAllLabel, newOptions) {
      allLabel = newAllLabel;
      options = newOptions;
      renderOptions();
      return setValue(value);
    }

    function open(focusSelected) {
      dropdownRegistry.forEach(function (other) { if (other !== api) other.close(false); });
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      if (focusSelected) {
        var els = optionEls();
        var selected = els.filter(function (el) { return el.getAttribute("aria-selected") === "true"; })[0] || els[0];
        if (selected) selected.focus();
      }
    }

    function close(returnFocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      if (returnFocus) btn.focus();
    }

    btn.addEventListener("click", function (event) {
      // event.detail === 0 : activé au clavier (Entrée / Espace) -> on place le focus dans la liste.
      if (panel.hidden) open(event.detail === 0);
      else close(false);
    });

    btn.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        open(true);
      }
    });

    panel.addEventListener("keydown", function (event) {
      var els = optionEls();
      var index = els.indexOf(document.activeElement);
      var target = null;
      if (event.key === "ArrowDown") target = els[Math.min(index + 1, els.length - 1)];
      else if (event.key === "ArrowUp") target = els[Math.max(index - 1, 0)];
      else if (event.key === "Home") target = els[0];
      else if (event.key === "End") target = els[els.length - 1];
      else if (event.key === "Tab") close(false);
      if (target) {
        event.preventDefault();
        target.focus();
      }
    });

    root.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        event.preventDefault();
        close(true);
      }
    });

    panel.addEventListener("click", function (event) {
      var option = event.target.closest(".dropdown__option");
      if (!option) return;
      var newValue = setValue(option.getAttribute("data-value") || "");
      close(true);
      onChange(newValue);
    });

    var api = {
      root: root,
      setOptions: setOptions,
      setValue: setValue,
      close: close
    };
    dropdownRegistry.push(api);
    return api;
  }

  document.addEventListener("click", function (event) {
    dropdownRegistry.forEach(function (dd) {
      if (!dd.root.contains(event.target)) dd.close(false);
    });
  });

  // Boutons "Réinitialiser" : ceux marqués data-hide-when-inactive ne s'affichent qu'avec un filtre actif.
  function setupResetButtons(onReset) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-filters-reset]"));
    buttons.forEach(function (btn) { btn.addEventListener("click", onReset); });
    return function update(active) {
      buttons.forEach(function (btn) {
        if (btn.hasAttribute("data-hide-when-inactive")) btn.hidden = !active;
      });
    };
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

    var allEvents = [];
    var filters = readUrlFilters({ query: "", dept: "", month: "", status: "" });

    function itemMatches(item) {
      if (filters.dept && item.dept !== filters.dept) return false;
      if (filters.month && monthKey(item.date) !== filters.month) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.query && !matchesQuery(item, filters.query)) return false;
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

      // Sans résultat, l'état vide porte déjà son propre bouton "Réinitialiser les filtres".
      updateResetButtons(hasActiveFilters(filters) && filtered.length > 0);
    }

    function update() {
      writeUrlFilters(filters);
      render();
    }

    var dropdowns = {};
    Array.prototype.slice.call(document.querySelectorAll("[data-dropdown]")).forEach(function (root) {
      var key = root.getAttribute("data-dropdown"); // "dept" | "month" | "status"
      dropdowns[key] = createDropdown(root, function (value) {
        filters[key] = value;
        update();
      });
    });

    var updateResetButtons = setupResetButtons(function () {
      Object.keys(filters).forEach(function (key) { filters[key] = ""; });
      Object.keys(dropdowns).forEach(function (key) { dropdowns[key].setValue(""); });
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      update();
    });

    // Remplit une liste et y applique la valeur venue de l'URL (ignorée si inconnue).
    function initDropdown(key, allLabel, options) {
      if (!dropdowns[key]) return;
      dropdowns[key].setOptions(allLabel, options);
      filters[key] = dropdowns[key].setValue(filters[key]);
    }

    if (searchInput) {
      searchInput.value = filters.query;
      searchInput.addEventListener("input", function () {
        filters.query = searchInput.value.trim();
        update();
      });
      searchInput.form.addEventListener("submit", function (event) {
        event.preventDefault();
        searchInput.blur(); // referme le clavier sur mobile
      });
    }

    fetchEvents()
      .then(function (data) {
        allEvents = data;
        initDropdown("dept", "Tous les départements", deptOptions(data));
        initDropdown("month", "Toutes les dates", monthOptions(data));
        initDropdown("status", "Tous les statuts", statusOptions());
        update();
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
    var mapFilters = readUrlFilters({ query: "", dept: "", status: "" });
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
      if (mapFilters.dept && item.dept !== mapFilters.dept) return false;
      if (mapFilters.query && !matchesQuery(item, mapFilters.query)) return false;
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

    /* ---- Sidebar bureau : recherche + toggle de statut ---- */
    var mapSearchInput = document.querySelector("[data-map-search-input]");
    var statusToggle = document.querySelector("[data-status-toggle]");

    // Le toggle bureau et la liste "Statut" mobile pilotent le même filtre.
    function syncStatusToggle() {
      if (!statusToggle) return;
      Array.prototype.slice.call(statusToggle.querySelectorAll(".status-toggle__btn")).forEach(function (btn) {
        btn.setAttribute("aria-pressed", (btn.getAttribute("data-status-value") || "") === mapFilters.status ? "true" : "false");
      });
    }

    function updateMap() {
      writeUrlFilters(mapFilters);
      updateMapResetButtons(hasActiveFilters(mapFilters));
      syncStatusToggle();
      renderMarkers();
    }

    var mapDropdowns = {};
    Array.prototype.slice.call(document.querySelectorAll(".map-filters [data-dropdown]")).forEach(function (root) {
      var key = root.getAttribute("data-dropdown"); // "dept" | "status"
      mapDropdowns[key] = createDropdown(root, function (value) {
        mapFilters[key] = value;
        updateMap();
      });
    });

    var updateMapResetButtons = setupResetButtons(function () {
      Object.keys(mapFilters).forEach(function (key) { mapFilters[key] = ""; });
      Object.keys(mapDropdowns).forEach(function (key) { mapDropdowns[key].setValue(""); });
      if (mapSearchInput) mapSearchInput.value = "";
      var firstChip = document.querySelector(".map-filters [data-filter-chip]");
      if (firstChip) firstChip.focus();
      updateMap();
    });

    if (mapSearchInput) {
      mapSearchInput.value = mapFilters.query;
      mapSearchInput.addEventListener("input", function () {
        mapFilters.query = mapSearchInput.value.trim();
        updateMap();
      });
    }

    if (statusToggle) {
      statusToggle.addEventListener("click", function (event) {
        var btn = event.target.closest(".status-toggle__btn");
        if (!btn) return;
        mapFilters.status = btn.getAttribute("data-status-value") || "";
        if (mapDropdowns.status) mapDropdowns.status.setValue(mapFilters.status);
        updateMap();
      });
    }

    function initMapDropdown(key, allLabel, options) {
      if (!mapDropdowns[key]) return;
      mapDropdowns[key].setOptions(allLabel, options);
      mapFilters[key] = mapDropdowns[key].setValue(mapFilters[key]);
    }

    fetchEvents()
      .then(function (data) {
        mapEvents = data;
        initMapDropdown("dept", "Tous les départements", deptOptions(data));
        initMapDropdown("status", "Tous les statuts", statusOptions());
        updateMap();
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

    // Carte d'info clé : icône + libellé en haut, valeur poussée en bas.
    function detailStatHTML(icon, label, value) {
      return (
        '<div class="detail-stat">' +
        '<div class="detail-stat__head"><svg class="icon" aria-hidden="true"><use href="#' + icon + '"></use></svg>' +
        '<span class="detail-stat__label">' + label + '</span></div>' +
        '<span class="detail-stat__value">' + value + '</span>' +
        '</div>'
      );
    }

    function renderDetail(item) {
      document.title = item.title + " — Sorties Enduro";

      detailRoot.innerHTML =
        '<div class="detail-title-meta" data-status="' + item.status + '">' +
        '<span class="badge">' + STATUS_LABEL[item.status] + '</span>' +
        '<h1>' + escapeHtml(item.title) + '</h1>' +
        '<p class="detail-meta-row"><svg class="icon" aria-hidden="true"><use href="#icon-location-dot"></use></svg>' +
        escapeHtml(item.location) + ' (' + escapeHtml(item.dept) + ') · ' + formatDateLabel(item.date) + (item.time ? ' · ' + escapeHtml(item.time) : '') +
        '</p>' +
        '</div>' +
        '<div class="detail-stats">' +
        detailStatHTML("icon-route", "Distance", item.distanceKm ? item.distanceKm + ' km' : '—') +
        detailStatHTML("icon-money-bill", "Tarif", item.price != null ? item.price + ' €' : '—') +
        detailStatHTML("icon-repeat", "Boucles", item.loops ? item.loops + (item.loops > 1 ? ' boucles' : ' boucle') : '—') +
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
        '<p>© 2026 Sorties Enduro</p>' +
        '<p class="site-footer__links">' +
        '<a href="#" aria-disabled="true" tabindex="-1">À propos <span class="sr-only">(bientôt disponible)</span></a>' +
        '<a href="contact.html">Contact</a>' +
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
})();
