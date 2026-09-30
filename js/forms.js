/* Formulaires : validation côté navigateur et envoi sans rechargement.
   S'applique à tout <form data-form>. Sans JavaScript, le formulaire reste
   utilisable : validation native du navigateur puis envoi classique vers "action". */
(function () {
  "use strict";

  var GENERIC_ERROR = "Une erreur est survenue. Vérifiez votre connexion puis réessayez.";

  function isCheckable(field) {
    return field.type === "checkbox" || field.type === "radio";
  }

  // Message d'erreur en français pour un champ, ou "" s'il est valide.
  // Un message propre au champ peut être fourni via data-msg-<règle>.
  function errorMessage(field) {
    var validity = field.validity;
    var custom = field.dataset;

    if (validity.valueMissing || (field.required && !isCheckable(field) && field.value.trim() === "")) {
      return custom.msgRequired || (isCheckable(field) ? "Cochez cette case pour continuer." : "Ce champ est obligatoire.");
    }
    if (validity.typeMismatch && field.type === "email") {
      return custom.msgType || "Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.";
    }
    if (validity.typeMismatch || validity.badInput) {
      return custom.msgType || "Le format saisi n’est pas valide.";
    }
    if (validity.tooShort || (field.minLength > 0 && field.value.trim() !== "" && field.value.trim().length < field.minLength)) {
      return custom.msgMin || "Saisissez au moins " + field.minLength + " caractères.";
    }
    if (validity.tooLong) {
      return custom.msgMax || "Saisissez au maximum " + field.maxLength + " caractères.";
    }
    if (validity.patternMismatch) {
      return custom.msgPattern || "Le format saisi n’est pas valide.";
    }
    if (validity.rangeUnderflow) {
      return custom.msgRange || "La valeur doit être supérieure ou égale à " + field.min + ".";
    }
    if (validity.rangeOverflow) {
      return custom.msgRange || "La valeur doit être inférieure ou égale à " + field.max + ".";
    }
    return "";
  }

  function setupForm(form) {
    var status = form.querySelector("[data-form-status]");
    var submitBtn = form.querySelector("[data-form-submit]");
    var success = document.querySelector('[data-form-success="' + form.id + '"]');
    var started = form.querySelector('[name="form_started"]');
    var fields = Array.prototype.slice.call(form.elements).filter(function (el) {
      return el.willValidate && el.tagName !== "BUTTON" && el.closest(".field");
    });

    // La validation est prise en charge ici : on coupe les bulles natives du navigateur.
    form.noValidate = true;
    if (started) started.value = String(Math.floor(Date.now() / 1000));

    function errorEl(field) {
      var id = field.id + "-error";
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement("p");
        el.id = id;
        el.className = "field__error";
        el.hidden = true;
        field.closest(".field").appendChild(el);
      }
      return el;
    }

    function describedBy(field, id, add) {
      var ids = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (v) {
        return v && v !== id;
      });
      if (add) ids.push(id);
      if (ids.length) field.setAttribute("aria-describedby", ids.join(" "));
      else field.removeAttribute("aria-describedby");
    }

    function showError(field, message) {
      var el = errorEl(field);
      el.textContent = message;
      el.hidden = !message;
      describedBy(field, el.id, !!message);
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
      return !message;
    }

    function validateField(field) {
      return showError(field, errorMessage(field));
    }

    function setStatus(message) {
      if (!status) return;
      status.textContent = message;
      status.hidden = !message;
    }

    function setBusy(busy) {
      if (!submitBtn) return;
      if (!submitBtn.dataset.label) submitBtn.dataset.label = submitBtn.textContent;
      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? "Envoi en cours…" : submitBtn.dataset.label;
    }

    fields.forEach(function (field) {
      // Première vérification en quittant le champ ; une fois en erreur, on revérifie à chaque frappe.
      field.addEventListener("blur", function () { validateField(field); });
      field.addEventListener(isCheckable(field) || field.tagName === "SELECT" ? "change" : "input", function () {
        if (field.getAttribute("aria-invalid") === "true") validateField(field);
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setStatus("");

      var invalid = fields.filter(function (field) { return !validateField(field); });
      if (invalid.length) {
        invalid[0].focus();
        return;
      }

      setBusy(true);
      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          return res.json().then(function (data) { return { res: res, data: data }; });
        })
        .then(function (result) {
          if (result.res.ok && result.data.ok) {
            form.hidden = true;
            if (success) {
              success.hidden = false;
              success.focus();
            }
            return;
          }

          // Erreurs de validation renvoyées par le serveur, champ par champ.
          var serverErrors = result.data.errors || {};
          var firstInvalid = null;
          fields.forEach(function (field) {
            if (serverErrors[field.name]) {
              showError(field, serverErrors[field.name]);
              if (!firstInvalid) firstInvalid = field;
            }
          });
          if (firstInvalid) firstInvalid.focus();
          else setStatus(result.data.message || GENERIC_ERROR);
        })
        .catch(function () {
          setStatus(GENERIC_ERROR);
        })
        .then(function () {
          setBusy(false);
        });
    });
  }

  Array.prototype.slice.call(document.querySelectorAll("form[data-form]")).forEach(setupForm);
})();
