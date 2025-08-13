# Flask API für Gruppenverwaltung
# Autor: [Dein Name]
# Datum: 13. August 2025
# Beschreibung: RESTful API zur Verwaltung von Gruppen mit SQLite-Datenbank

from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_sqlalchemy import SQLAlchemy
import logging
import os

# Flask-App initialisieren
app = Flask(__name__)

# CORS-Konfiguration: Erlaubt Cross-Origin-Requests für Frontend-Integration
@app.after_request
def after_request(response):
    """
    Fügt CORS-Headers zu allen API-Responses hinzu.
    Ermöglicht es dem Frontend, von verschiedenen Domains auf die API zuzugreifen.
    """
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Datenbank-Konfiguration: SQLite-Datenbank im instances-Ordner
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "instances", "Gruppen.db")}'
db = SQLAlchemy(app)

# Logging-Konfiguration: Schreibt API-Aktivitäten in eine Log-Datei
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='api_debug.log',
    filemode='a'
)
logger = logging.getLogger('family_api')

# Datenbank-Modell: Definiert die Struktur der Gruppen-Tabelle
class Group(db.Model):
    """
    SQLAlchemy-Modell für Gruppen.
    Jede Gruppe hat eine eindeutige ID und einen Namen.
    """
    __tablename__ = 'Gruppen'  # Tabellenname in der Datenbank
    id = db.Column(db.Integer, primary_key=True)    # Eindeutige ID (Auto-Increment)
    name = db.Column(db.String(100), nullable=False)  # Gruppenname (max. 100 Zeichen)

# OPTIONS-Route für CORS Preflight-Requests
@app.route('/groups', methods=['OPTIONS'])
def options_groups():
    """
    Behandelt CORS Preflight-Requests für /groups Endpunkt.
    Wird vom Browser automatisch vor Cross-Origin-Requests gesendet.
    """
    return '', 200

# API-Endpunkt: Alle Gruppen abrufen
@app.route('/groups', methods=['GET'])
def get_groups():
    """
    Ruft alle Gruppen aus der Datenbank ab.
    
    Returns:
        JSON: {'success': True, 'groups': [{'id': 1, 'name': 'Gruppe1'}, ...]}
    """
    try:
        # Alle Gruppen aus der Datenbank laden
        groups = Group.query.all()
        groups_list = []
        
        # Gruppen in JSON-Format konvertieren
        for group in groups:
            groups_list.append({
                'id': group.id,
                'name': group.name
            })
        return jsonify({'success': True, 'groups': groups_list})
    
    except Exception as e:
        logger.error(f"Fehler beim Laden der Gruppen: {e}")
        return jsonify({'success': False, 'message': 'Fehler beim Laden der Gruppen'}), 500

# API-Endpunkt: Neue Gruppe hinzufügen
@app.route('/groups', methods=['POST'])
def add_group():
    """
    Fügt eine neue Gruppe zur Datenbank hinzu.
    
    Expected JSON: {'name': 'Gruppenname'}
    
    Returns:
        JSON: {'success': True, 'message': 'Gruppe hinzugefügt'} oder Fehlermeldung
    """
    try:
        # Gruppenname aus JSON-Request extrahieren
        name = request.json.get('name')  # JSON Format: {"name": "Gruppenname"}
        
        # Validierung: Name darf nicht leer sein
        if not name:
            return jsonify({'success': False, 'message': 'Name ist erforderlich'}), 400
        
        # Neue Gruppe erstellen und in Datenbank speichern
        new_group = Group(name=name)
        db.session.add(new_group)
        db.session.commit()
        
        logger.info(f"Neue Gruppe hinzugefügt: {name}")
        return jsonify({'success': True, 'message': 'Gruppe hinzugefügt'})
        
    except Exception as e:
        logger.error(f"Fehler beim Hinzufügen der Gruppe: {e}")
        return jsonify({'success': False, 'message': 'Fehler beim Hinzufügen'}), 500

# API-Endpunkt: Gruppe löschen
@app.route('/group/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    try:
        # Gruppe anhand der ID in der Datenbank suchen
        group = Group.query.get_or_404(group_id)
        
        # Gruppenname für Log-Meldung speichern
        group_name = group.name
        
        # Gruppe aus Datenbank löschen
        db.session.delete(group)
        db.session.commit()
        
        logger.info(f"Gruppe gelöscht: {group_name} (ID: {group_id})")
        return jsonify({'success': True, 'message': 'Group erfolgreich gelöscht'})
        
    except Exception as e:
        logger.error(f"Fehler beim Löschen der Gruppe: {e}")
        return jsonify({'success': False, 'message': 'Fehler beim Löschen der Gruppe'}), 500

# CORS-Unterstützung für OPTIONS-Requests (Preflight-Requests)
@app.route('/groups', methods=['OPTIONS'])
@app.route('/group/<int:group_id>', methods=['OPTIONS'])
def options_delete_group(group_id=None):
    return '', 200
    
# Startet die Flask-Anwendung im Debug-Modus
if __name__ == '__main__':
    # Debug-Modus für Entwicklung aktivieren (automatisches Neuladen bei Dateiänderungen)
    app.run(debug=True)