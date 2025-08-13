/**
 * API-Client für Gruppenverwaltung
 *
 * Beschreibung: Zentrale Schnittstelle für alle API-Anfragen an den Flask-Backend
 * Enthält CRUD-Operationen für Gruppen und UI-Management für Choices.js
 *
 * Autor: Informationsteamarbeit
 * Datum: 2024
 */

// Basis-URL für API-Anfragen an Flask-Backend
const url = "http://localhost:5000/groups";

// Globale Variable für Choices.js Instanz
let choicesInstance = null;

// Global Objekt erstellen falls nicht vorhanden (für mehrere HTML-Seiten)
if (typeof Global === "undefined") {
	window.Global = {};
}
// Speichert alle verfügbaren Gruppen für Frontend-Zugriff
Global.allGroups = [];

// Schutz gegen mehrfache Ausführung von Löschoperationen
let isDeletingInProgress = false;

/**
 * Lädt alle Gruppen vom Flask-API und aktualisiert UI-Komponenten
 *
 * Funktionsweise:
 * - Sendet GET-Request an /groups Endpoint
 * - Konvertiert Daten in Choices.js Format
 * - Aktualisiert globales allGroups Array
 * - Erneuert bestehende Choices.js Instanzen
 */
function ladeGruppen() {
	// Verhindert Laden während Löschoperationen
	if (isDeletingInProgress) {
		return;
	}

	// API-Anfrage an Flask-Backend
	fetch(url)
		.then((res) => res.json())
		.then((data) => {
			// Konvertierung in Choices.js Format: {value: id, label: name}
			const choicesArray = data.groups.map((group) => ({
				value: group.id,
				label: group.name,
			}));
			Global.allGroups = choicesArray;

			// Aktualisiere nur group-select Choices falls bereits initialisiert
			if (window.groupChoicesInstance) {
				window.groupChoicesInstance.setChoices(
					choicesArray,
					"value",
					"label",
					true // Clear existing choices before setting new ones
				);
			}

			// Aktualisiere group-select-loeschen Choices falls vorhanden (Löschseite)
			if (window.groupChoicesLoeschenInstance && !isDeletingInProgress) {
				window.groupChoicesLoeschenInstance.setChoices(
					choicesArray,
					"value",
					"label",
					true // Clear existing choices before setting new ones
				);
			}

			// Führe getAllYears aus, nachdem die Gruppen geladen wurden (für Jahr-Filter)
			if (typeof getAllYears === "function" && !isDeletingInProgress) {
				getAllYears();
			}
		})
		.catch((error) => {
			console.error("Fehler beim Laden der Gruppen:", error);
		});
}

/**
 * DOM Content Loaded Handler - Initialisiert UI-Komponenten
 *
 * Funktionsweise:
 * - Prüft welche HTML-Elemente auf der aktuellen Seite vorhanden sind
 * - Initialisiert Choices.js nur für vorhandene Elemente
 * - Lädt initial alle Gruppendaten
 */
document.addEventListener("DOMContentLoaded", function () {
	// Prüfe ob #group-select existiert, aber initialisiere Choices NICHT sofort
	// (wird erst bei Bedarf in script.js initialisiert)
	const groupSelect = document.getElementById("group-select");

	// Prüfe ob #group-select-loeschen existiert und initialisiere Choices sofort (Löschseite)
	const groupSelectLoeschen = document.getElementById("group-select-loeschen");
	if (groupSelectLoeschen) {
		// Choices.js Instanz für Multi-Select Löschfunktionalität erstellen
		window.groupChoicesLoeschenInstance = new Choices(
			"#group-select-loeschen",
			{
				searchEnabled: true, // Aktiviert Suchfunktion im Dropdown
				placeholderValue: "Gruppe zum Löschen wählen",
				searchPlaceholderValue: "Suchen...",
				removeItemButton: true, // Ermöglicht das Entfernen einzelner Auswahlen
			}
		);
	}

	// Lade Gruppen immer (für year-select und group-select-loeschen)
	ladeGruppen();
});

/**
 * Fügt eine neue Gruppe zur Datenbank hinzu
 *
 * Funktionsweise:
 * - Liest Gruppennamen aus Input-Feld
 * - Sendet POST-Request an Flask-API
 * - Aktualisiert UI bei erfolgreichem Hinzufügen
 * - Zeigt Benutzer-Feedback an
 */
function hinzufuegen() {
	// Gruppennamen aus Input-Feld extrahieren
	const gruppenname = document.querySelector(".add-group input").value;

	if (gruppenname) {
		// POST-Request an Flask-API senden
		fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: gruppenname }), // JSON-Format für Flask-API
		})
			.then((response) => {
				if (response.ok) {
					console.log("Neue Gruppe hinzugefügt:", gruppenname);

					// Input-Feld zurücksetzen
					document.querySelector(".add-group input").value = "";

					// Gruppenliste neu laden für aktuelle UI-Updates
					ladeGruppen();
				} else {
					console.error("Fehler beim Hinzufügen der Gruppe");
					alert("Fehler beim Hinzufügen der Gruppe. Bitte versuche es erneut.");
				}
			})
			.catch((error) => {
				console.error("Fehler:", error);
				alert(
					"Netzwerkfehler beim Hinzufügen der Gruppe. Bitte versuche es erneut."
				);
			});
	} else {
		alert("Bitte gib einen Gruppennamen ein.");
	}
}

/**
 * Löscht ausgewählte Gruppen sequenziell
 *
 * Funktionsweise:
 * - Sammelt alle ausgewählten Gruppen-IDs
 * - Führt Löschoperationen sequenziell aus (nicht parallel)
 * - Verhindert Live Server WebSocket-Interferenz durch sequenzielle Verarbeitung
 * - Aktualisiert UI nach erfolgreichem Löschen
 */
function loeschen() {
	// Verhindere mehrfache parallele Ausführung
	if (isDeletingInProgress) {
		return;
	}

	// Flag setzen um andere Operationen zu blockieren
	isDeletingInProgress = true;

	let selectedGroups = [];

	// Prüfe ob Choices.js für group-select-loeschen verwendet wird
	if (window.groupChoicesLoeschenInstance) {
		// Extrahiere ausgewählte Werte aus Choices.js Multi-Select
		const valueArray = window.groupChoicesLoeschenInstance.getValue(true);
		const valueObjects = window.groupChoicesLoeschenInstance.getValue();

		// Verwende die Objekt-Methode als Fallback
		if (valueArray && valueArray.length > 0) {
			selectedGroups = valueArray; // Array von IDs
		} else if (valueObjects && valueObjects.length > 0) {
			selectedGroups = valueObjects.map((item) => item.value); // Extrahiere IDs aus Objekten
		}
	} else {
		// Fallback für normales Select-Element (falls Choices.js nicht verfügbar)
		const selectElement = document.getElementById("group-select-loeschen");
		if (selectElement) {
			selectedGroups = Array.from(selectElement.selectedOptions).map(
				(option) => option.value
			);
		}
	}

	// Validierung: Mindestens eine Gruppe muss ausgewählt sein
	if (selectedGroups.length === 0) {
		alert("Bitte wähle mindestens eine Gruppe zum Löschen aus.");
		isDeletingInProgress = false; // Flag zurücksetzen
		return;
	}

	// Rufe sequenzielle Löschfunktion auf (Array kopieren für Unveränderlichkeit)
	deleteGroupsSequentially([...selectedGroups]);
}

/**
 * Führt Löschoperationen sequenziell aus
 *
 * Args:
 *   groupsToDelete (Array): Array von Gruppen-IDs zum Löschen
 *
 * Funktionsweise:
 * - Iteriert durch alle zu löschenden Gruppen
 * - Sendet DELETE-Request für jede Gruppe einzeln
 * - Wartet auf Antwort bevor nächste Gruppe gelöscht wird
 * - Verhindert WebSocket-Interferenz durch sequenzielle Verarbeitung
 * - Zeigt Erfolgsmeldung und aktualisiert UI am Ende
 */
async function deleteGroupsSequentially(groupsToDelete) {
	let successCount = 0; // Zähler für erfolgreich gelöschte Gruppen
	let errorCount = 0; // Zähler für Fehler

	// Sequenzielle Verarbeitung aller zu löschenden Gruppen
	for (let i = 0; i < groupsToDelete.length; i++) {
		const groupValue = groupsToDelete[i];
		const groupId = parseInt(groupValue); // String zu Integer konvertieren

		// Validierung der Gruppen-ID
		if (isNaN(groupId)) {
			errorCount++;
			continue; // Überspringe ungültige IDs
		}

		try {
			// DELETE-Request an Flask-API senden
			const response = await fetch(`http://localhost:5000/group/${groupId}`, {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (response.ok) {
				successCount++;
			} else {
				errorCount++;
			}
		} catch (error) {
			if (error.message.includes("Failed to fetch")) {
				await new Promise((resolve) => setTimeout(resolve, 100));

				try {
					const retryResponse = await fetch(
						`http://localhost:5000/group/${groupId}`,
						{
							method: "DELETE",
							headers: {
								"Content-Type": "application/json",
							},
						}
					);

					if (retryResponse.ok) {
						successCount++;
					} else {
						errorCount++;
					}
				} catch (retryError) {
					errorCount++;
				}
			} else {
				errorCount++;
			}
		}
	}

	// Sperre aufheben
	isDeletingInProgress = false;

	// UI aktualisieren
	if (window.groupChoicesLoeschenInstance && successCount > 0) {
		// Auswahl bereinigen
		window.groupChoicesLoeschenInstance.removeActiveItems();

		// Liste nach 500ms neu laden (kurze Verzögerung für Server)
		setTimeout(() => {
			ladeGruppen();
		}, 500);
	}

	// Erfolgsmeldung anzeigen
	if (successCount > 0) {
		//alert(`${successCount} Gruppe(n) erfolgreich gelöscht.`);
	}
	if (errorCount > 0) {
		alert(`${errorCount} Gruppe(n) konnten nicht gelöscht werden.`);
	}
}
