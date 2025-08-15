/**
 * Frontend-Logik für Nachrichtenverwaltung und UI-Interaktionen
 *
 * Beschreibung: Hauptfunktionalitäten für Gruppenauswahl, Nachrichtenversand,
 * Jahr-Filterung und Benutzerinteraktionen auf allen HTML-Seiten
 *
 * Autor: Informationsteamarbeit
 * Datum: 2024
 */

/**
 * Schaltet alle Checkboxen einer Kategorie gleichzeitig um
 *
 * Args:
 *   masterCheckbox (HTMLElement): Master-Checkbox die alle anderen steuert
 *   type (string): CSS-Klasse der zu steuernden Checkboxen
 */
function toggleAll(masterCheckbox, type) {
	const checkboxes = document.querySelectorAll(`.${type}`);
	checkboxes.forEach((cb) => (cb.checked = masterCheckbox.checked));
}

/**
 * Versendet Nachricht an ausgewählte Gruppen
 *
 * Funktionsweise:
 * - Sammelt Nachrichtentext und ausgewählte Gruppen
 * - Unterstützt sowohl Choices.js als auch normale Select-Elemente
 * - Erstellt JSON mit allen relevanten Daten
 * - Setzt Formular nach erfolgreichem Versand zurück
 * - Aktualisiert automatisch die Seite für neue Eingaben
 */
function senden() {
	// Nachrichtentext aus Textarea extrahieren
	const message = document.getElementById("message").value;
	let selectedGroupIds = [];
	let selectedGroupNames = [];

	// Prüfe ob "An alle senden" aktiviert ist
	const sendToAllCheckbox = document.querySelector("#sendToAll");
	if (sendToAllCheckbox && sendToAllCheckbox.checked) {
		// Ermittle aktuelle Filter wie in der Checkbox-Logik
		const selectedYears = [];
		const selectedStudTypes = [];

		// Jahr-Filter ermitteln
		if (window.yearChoicesInstance) {
			const yearValues = window.yearChoicesInstance.getValue();
			yearValues.forEach((item) => selectedYears.push(item.value));
		}

		// Studenten-Art-Filter ermitteln
		if (window.studChoicesInstance) {
			const studValues = window.studChoicesInstance.getValue();
			studValues.forEach((item) => selectedStudTypes.push(item.value));
		}

		// Filtere Gruppen basierend auf aktuellen Auswahlen
		let filteredGroups = Global.allGroups || [];

		if (selectedYears.length > 0 || selectedStudTypes.length > 0) {
			filteredGroups = Global.allGroups.filter((group) => {
				let yearMatch = true;
				let typeMatch = true;

				// Prüfe Jahr-Filter
				if (selectedYears.length > 0) {
					const year = extractYearFromGroupName(group.label);
					yearMatch = selectedYears.includes(year);
				}

				// Prüfe Art-Filter (Studenten vs. Auszubildende)
				if (selectedStudTypes.length > 0) {
					// Mappe Frontend-Werte zu Datenbank-Werten
					const dbArtValues = selectedStudTypes.map((studType) => {
						if (studType === "studenten") return "1";
						if (studType === "auszubildende") return "2";
						return studType; // Fallback für direkte Zahlen
					});

					const groupArt = group.art ? group.art.toString() : "1";
					typeMatch = dbArtValues.includes(groupArt);
				}

				return yearMatch && typeMatch;
			});
		}

		selectedGroupNames = filteredGroups.map((group) => group.label);
	} else {
		// Normale Gruppenauswahl über Choices.js
		if (window.groupChoicesInstance) {
			// Extrahiere ausgewählte Gruppen-IDs aus Choices.js
			selectedGroupIds = window.groupChoicesInstance.getValue(true);

			// Konvertiere IDs zu Gruppennamen für Anzeige/Logging
			selectedGroupNames = selectedGroupIds.map((id) => {
				const group = Global.allGroups.find((g) => g.value == id);
				return group ? group.label : id;
			});
		} else {
			// Fallback für normales Select-Element
			const groupSelect = document.getElementById("group-select");
			if (groupSelect) {
				selectedGroupIds = Array.from(groupSelect.selectedOptions).map(
					(option) => option.value
				);

				// Wandle IDs in Namen um für konsistente Verarbeitung
				selectedGroupNames = selectedGroupIds.map((id) => {
					const group = Global.allGroups.find((g) => g.value == id);
					return group ? group.label : id;
				});
			}
		}
	}

	// Validierung: Nachricht und Gruppenauswahl sind erforderlich
	if (selectedGroupNames.length == 0 || message == "") {
		console.error(
			"Validierung fehlgeschlagen - Gruppen:",
			selectedGroupNames.length,
			"Message leer:",
			message == ""
		);
		alert("fehlende Angaben");
		return;
	}

	// Erstelle JSON-Objekt für Verarbeitung/Speicherung
	const myObject = {
		message: message,
		groups: selectedGroupNames,
	};
	buildJson(myObject, selectedGroupNames);
}

/**
 * Erstellt JSON-String und führt automatische Formular-Zurücksetzung durch
 *
 * Args:
 *   myObject (Object): Objekt mit Nachricht und Gruppen-Array
 *   selectedGroupNames (Array): Array mit Gruppennamen für URL-Generierung
 *
 * Funktionsweise:
 * - Konvertiert Objekt zu JSON-String für Anzeige/Logging
 * - Setzt Nachrichtenfeld automatisch zurück
 * - Erneuert Choices.js Auswahl für nächste Eingabe
 * - Lädt Gruppendaten neu für aktuellen Zustand
 */
function buildJson(myObject, selectedGroupNames) {
	// Konvertiere Objekt zu formattiertem JSON-String
	const jsonString = JSON.stringify(myObject, null, 2);
	selectedGroupNames.forEach((groupName) => {
		sendJSON(jsonString, groupName);
	});

	// Erfolgsmeldung und Seitenaktualisierung
	alert("Nachricht erfolgreich gesendet!");

	// Formular zurücksetzen und Seite nach kurzer Verzögerung aktualisieren
	setTimeout(() => {
		// Nachrichtenfeld leeren
		document.getElementById("message").value = "";

		// Choices.js Auswahl zurücksetzen
		if (window.groupChoicesInstance) {
			window.groupChoicesInstance.removeActiveItems();
		}

		// "An alle senden" Checkbox zurücksetzen
		const sendToAllCheckbox = document.querySelector("#sendToAll");
		if (sendToAllCheckbox) {
			sendToAllCheckbox.checked = false;
		}

		// ENTFERNT: ladeGruppen() Aufruf um Endlosschleife zu vermeiden
		console.log("Formular zurückgesetzt - bereit für neue Nachricht");
	}, 500); // 500ms Verzögerung für UI-Aktualisierung
}

/**
 * Extrahiert alle verfügbaren Jahre aus Gruppennamen für Jahr-Filter
 *
 * Funktionsweise:
 * - Iteriert durch alle verfügbaren Gruppen
 * - Extrahiert Jahre aus Gruppennamen mit Regex-Pattern
 * - Entfernt Duplikate für eindeutige Jahr-Liste
 * - Aktualisiert Jahr-Select Dropdown
 */
function getAllYears() {
	allGroups = Global.allGroups; // Referenz auf globale Gruppenliste
	allYears = []; // Reset der Jahre-Liste

	// Durchlaufe alle Gruppen und extrahiere Jahre
	allGroups.forEach((group) => {
		const year = extractYearFromGroupName(group.label);
		if (year) {
			// Prüfe auf Duplikate (ineffizient aber funktional für kleine Listen)
			var isin = false;
			for (let i = 0; i < 5; i++) {
				if (allYears[i] === year) {
					isin = true;
					break;
				}
			}
			// Füge Jahr hinzu wenn noch nicht vorhanden
			if (!isin) {
				allYears.push(year);
			}
		}
	});
	jahrgangAktualisieren(allYears); // Aktualisiere UI mit extrahierten Jahren
}

/**
 * Extrahiert Jahreszahl aus Gruppennamen mit Regex-Pattern
 *
 * Args:
 *   groupName (string): Name der Gruppe (z.B. "DI24/01")
 *
 * Returns:
 *   string|null: Extrahierte Jahreszahl oder null wenn kein Match
 */
function extractYearFromGroupName(groupName) {
	// Regex-Pattern für Format AA11/11: 2 Buchstaben gefolgt von 2 Ziffern und Slash
	const match = groupName.match(/[A-Z]{2}(\d{2})\/\d{2}/);
	return match ? match[1] : null;
}

function jahrgangAktualisieren(allYears) {
	const yearSelect = document.getElementById("year-select");
	if (yearSelect) {
		yearSelect.innerHTML = "";

		const sortedYears = [...new Set(allYears)].sort();

		sortedYears.forEach((year) => {
			const option = document.createElement("option");
			option.value = year;
			option.textContent = "20" + year;
			yearSelect.appendChild(option);
		});

		yearSelect.removeEventListener("change", handleYearChange);
		yearSelect.addEventListener("change", handleYearChange);

		if (typeof Choices !== "undefined" && !window.yearChoicesInstance) {
			window.yearChoicesInstance = new Choices("#year-select", {
				searchEnabled: true,
				placeholderValue: "Jahrgang wählen",
				searchPlaceholderValue: "Suchen...",
				removeItemButton: true,
			});

			if (window.yearChoicesInstance) {
				yearSelect.addEventListener("change", handleYearChange);
			}
		}
	} else {
		groupSelectVerstecken();
	}

	function handleYearChange() {
		checkAuswahlYear();
	}
}

function checkAuswahlYear() {
	const yearSelect = document.getElementById("year-select");
	const messageElement = document.querySelector("#message"); // Prüfe ob Nachrichten-Seite
	const selectedYears = [];

	// Falls Choices.js verwendet wird
	if (window.yearChoicesInstance) {
		const selectedValues = window.yearChoicesInstance.getValue();
		selectedValues.forEach((item) => selectedYears.push(item.value));
	} else {
		// Fallback für normales Select
		const options = yearSelect.selectedOptions;
		for (let option of options) {
			selectedYears.push(option.value);
		}
	}

	if (messageElement) {
		// Nachrichten-Seite: Zeige stud-select nach Jahr-Auswahl
		if (selectedYears.length > 0) {
			studSelectAnzeigen();

			// Falls bereits Studententypen ausgewählt sind, aktualisiere auch die Gruppenauswahl
			const selectedStudTypes = [];
			if (window.studChoicesInstance) {
				const studValues = window.studChoicesInstance.getValue();
				studValues.forEach((item) => selectedStudTypes.push(item.value));
			}

			// Wenn sowohl Jahre als auch Studententypen ausgewählt sind, zeige gefilterte Gruppen
			if (selectedStudTypes.length > 0) {
				groupSelectAnzeigen(selectedYears, selectedStudTypes);
			}
		} else {
			// Verstecke beide Container wenn kein Jahr ausgewählt
			studSelectVerstecken();
			groupSelectVerstecken();
		}
	}
}

function studSelectAnzeigen() {
	const studSelectContainer = document.querySelector(".stud-select-container");
	if (studSelectContainer) {
		studSelectContainer.style.display = "block"; // Explizit anzeigen
		studSelectContainer.classList.add("visible");
	}
}

function studSelectVerstecken() {
	const studSelectContainer = document.querySelector(".stud-select-container");
	if (studSelectContainer) {
		studSelectContainer.classList.remove("visible");
		// Zusätzlich: Stelle sicher, dass der Container wirklich versteckt ist
		studSelectContainer.style.display = "none";
	}
}

function handleStudChange() {
	const studSelect = document.getElementById("stud-select");
	const messageElement = document.querySelector("#message"); // Prüfe ob Nachrichten-Seite

	// Nur auf Nachrichten-Seite aktiv werden
	if (!messageElement) {
		return; // Früher Ausstieg für Index-Seite
	}

	const selectedStudTypes = [];

	// Falls Choices.js verwendet wird
	if (window.studChoicesInstance) {
		const selectedValues = window.studChoicesInstance.getValue();
		selectedValues.forEach((item) => selectedStudTypes.push(item.value));
	} else {
		// Fallback für normales Select
		const options = studSelect.selectedOptions;
		for (let option of options) {
			selectedStudTypes.push(option.value);
		}
	}

	// Nachrichten-Seite: Zeige gefilterte Gruppen basierend auf Art UND Jahr
	if (selectedStudTypes.length > 0) {
		// Ermittle auch die aktuell ausgewählten Jahre
		const selectedYears = [];
		if (window.yearChoicesInstance) {
			const yearValues = window.yearChoicesInstance.getValue();
			yearValues.forEach((item) => selectedYears.push(item.value));
		}

		// Zeige Gruppen-Container und initialisiere Choices.js falls nötig
		const groupSelectContainer = document.querySelector(
			".group-select-container"
		);
		if (groupSelectContainer) {
			groupSelectContainer.classList.add("visible");

			// Initialisiere Choices.js für Gruppen falls noch nicht geschehen
			if (typeof Choices !== "undefined" && !window.groupChoicesInstance) {
				window.groupChoicesInstance = new Choices("#group-select", {
					searchEnabled: true,
					placeholderValue: "Gruppe wählen",
					searchPlaceholderValue: "Suchen...",
					removeItemButton: true,
				});
			}
		}

		// Berücksichtige SOWOHL Jahr- ALS AUCH Art-Filter
		groupSelectAnzeigen(selectedYears, selectedStudTypes);
	} else {
		// Keine Auswahl: Verstecke Gruppen-Container und leere Liste
		groupSelectVerstecken();
		if (window.groupChoicesInstance) {
			window.groupChoicesInstance.clearStore();
		}
	}
}
function groupSelectAnzeigen(selectedYears = [], selectedStudTypes = []) {
	const groupSelectContainer = document.querySelector(
		".group-select-container"
	);
	if (groupSelectContainer) {
		groupSelectContainer.classList.add("visible");

		// Filtere Gruppen nach ausgewählten Jahrgängen und Arten
		let filteredGroups = Global.allGroups || [];

		if (selectedYears.length > 0 || selectedStudTypes.length > 0) {
			filteredGroups = Global.allGroups.filter((group) => {
				let yearMatch = true;
				let typeMatch = true;

				// Prüfe Jahr-Filter
				if (selectedYears.length > 0) {
					const year = extractYearFromGroupName(group.label);
					yearMatch = selectedYears.includes(year);
				}

				// Prüfe Art-Filter (Studenten vs. Auszubildende)
				if (selectedStudTypes.length > 0) {
					// Mappe Frontend-Werte zu Datenbank-Werten
					const dbArtValues = selectedStudTypes.map((studType) => {
						if (studType === "studenten") return "1";
						if (studType === "auszubildende") return "2";
						return studType; // Fallback für direkte Zahlen
					});

					const groupArt = group.art ? group.art.toString() : "1";
					typeMatch = dbArtValues.includes(groupArt);
				}

				return yearMatch && typeMatch;
			});
		}

		// Initialisiere Choices.js für group-select falls noch nicht gemacht
		if (typeof Choices !== "undefined" && !window.groupChoicesInstance) {
			window.groupChoicesInstance = new Choices("#group-select", {
				searchEnabled: true,
				placeholderValue: "Gruppe wählen",
				searchPlaceholderValue: "Suchen...",
				removeItemButton: true,
			});
		}

		// Aktualisiere die Gruppen basierend auf dem Filter
		if (window.groupChoicesInstance && filteredGroups.length > 0) {
			window.groupChoicesInstance.clearStore();
			window.groupChoicesInstance.setChoices(
				filteredGroups,
				"value",
				"label",
				true
			);
		}
	}
}

function groupSelectVerstecken() {
	const groupSelectContainer = document.querySelector(
		".group-select-container"
	);

	const studSelectContainer = document.querySelector(".stud-select-container");
	if (groupSelectContainer) {
		groupSelectContainer.classList.remove("visible");
	}
}
function anmeldenVerstecken() {
	const anmeldenContainer = document.querySelector("#anmeldenContainer");
	const groupSelectContainer = document.querySelector(
		".group-select-container"
	);
	if (anmeldenContainer) {
		anmeldenContainer.classList.remove("visible");
	}
	if (groupSelectContainer) {
		groupSelectContainer.classList.remove("visible");
	}
}

// Schutz vor mehrfacher Initialisierung
let initializationComplete = false;

document.addEventListener("DOMContentLoaded", () => {
	if (initializationComplete) {
		console.warn("Script bereits initialisiert - überspringe");
		return;
	}
	initializationComplete = true;

	// Content initial verstecken, bis Login erfolgt ist
	if (
		window.FamilienApp &&
		typeof window.FamilienApp.hideContent === "function"
	) {
		window.FamilienApp.hideContent();
	}

	// Prüfe ob Benutzer eingeloggt ist (localStorage)
	const benutzer = localStorage.getItem("benutzer");
	if (benutzer) {
		// Content anzeigen
		if (
			window.FamilienApp &&
			typeof window.FamilienApp.showContent === "function"
		) {
			window.FamilienApp.showContent();
		}
		// Anmeldeformular ausblenden
		const anmeldenContainer = document.getElementById("anmeldenContainer");
		if (anmeldenContainer) anmeldenContainer.style.display = "none";
	} else {
		// Content verstecken, Anmeldeformular anzeigen
		if (
			window.FamilienApp &&
			typeof window.FamilienApp.hideContent === "function"
		) {
			window.FamilienApp.hideContent();
		}
		const anmeldenContainer = document.getElementById("anmeldenContainer");
		if (anmeldenContainer) anmeldenContainer.style.display = "block";
	}

	// ...existing code...

	// Restliche Initialisierung wie gehabt
	// ...existing code...
});

// Globaler Enter-Event Listener
document.addEventListener("keydown", function (event) {
	if (event.key === "Enter") {
		const currentPage = getCurrentPage();
		handleEnterOnPage(currentPage);
	}
});

function getCurrentPage() {
	const currentUrl = window.location.pathname;
	const fileName = currentUrl.split("/").pop();
	return fileName || "index.html";
}

function handleEnterOnPage(page) {
	switch (page) {
		case "Nachichten.html":
			senden();
			break;

		case "Loeschen.html":
			// Prüfe ob bereits ein Löschvorgang läuft
			if (typeof isDeletingInProgress !== "undefined" && isDeletingInProgress) {
				return;
			}
			loeschen();
			break;

		case "hinzufuegen.html":
			hinzufuegen();
			break;
	}
}
function stud() {
	const studSelectContainer = document.querySelector(".stud-select-container");
	const studSelectElement = document.querySelector("#stud-select");

	if (!studSelectElement) {
		console.log(
			"stud-select Element nicht gefunden - überspringe Initialisierung"
		);
		return;
	}

	if (typeof Choices !== "undefined" && !window.studChoicesInstance) {
		window.studChoicesInstance = new Choices("#stud-select", {
			searchEnabled: true,
			placeholderValue: "Studenten oder Auszubildende wählen",
			searchPlaceholderValue: "Suchen...",
			removeItemButton: true,
			choices: [
				{
					value: "studenten",
					label: "Studenten",
					disabled: false,
				},
				{
					value: "auszubildende",
					label: "Auszubildende",
					disabled: false,
				},
			],
		});

		if (window.studChoicesInstance) {
			const studSelect = document.getElementById("stud-select");
			if (studSelect) {
				studSelect.addEventListener("change", handleStudChange);
			}
		}
	}
}

function sendJSON(jsonFile, group) {
	const data = jsonFile;
	console.log("Original Gruppenname:", group);

	const match = group.match(/([A-Z]{2}\d{2})\/\d{2}/);

	if (match) {
		const extractedGroup = match[1];
		console.log("Extrahierte Gruppe:", extractedGroup);
		console.log("Neue Nachricht an Gruppe:", extractedGroup);

		fetch(`https://ntfy.sh/${extractedGroup}120592`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Title: "Neue Nachricht",
			},
			body: data,
		})
			.then((res) => console.log("Gesendet:", res.status))
			.catch((err) => console.error("Fehler:", err));
	}
}
// Verhindert das Neuladen der Seite beim Login und ruft checkAnmeldung auf
document.addEventListener("DOMContentLoaded", function () {
	var loginForm = document.getElementById("loginForm");
	if (loginForm) {
		loginForm.addEventListener("submit", function (e) {
			e.preventDefault();
			if (typeof checkAnmeldung === "function") checkAnmeldung();
		});
	}
});
function abbrechen() {
	const popup = document.getElementById("popup");
	if (popup) {
		popup.style.display = "none"; // Verstecke das Popup
	}
}
