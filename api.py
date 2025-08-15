# Flask API für Gruppenverwaltung
# Autor: [Dein Name]
# Datum: 13. August 2025
# Beschreibung: RESTful API zur Verwaltung von Gruppen mit SQLite-Datenbank


from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_sqlalchemy import SQLAlchemy
import logging
import os
from werkzeug.security import check_password_hash, generate_password_hash
from flask_cors import CORS
import hashlib
import hmac
import base64

# Flask-App initialisieren
app = Flask(__name__)

# CORS vollständig konfigurieren
CORS(app, 
     origins=['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
     methods=['GET', 'POST', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'])



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

def check_django_password(password, encoded):
    """
    Überprüft ein Passwort gegen einen Django-Hash.
    Django-Format: algorithm$salt$hash
    """
    try:
        parts = encoded.split('$')
        if len(parts) != 3:
            return False
            
        algorithm, salt, hash_value = parts
        
        if algorithm == '1':  # PBKDF2 mit SHA1
            iterations = 10000  # Django default
            key = hashlib.pbkdf2_hmac('sha1', password.encode('utf-8'), salt.encode('utf-8'), iterations)
            computed_hash = key.hex()  # Als Hex-String statt base64
            return computed_hash == hash_value
            
        elif algorithm == '2':  # PBKDF2 mit SHA256
            iterations = 10000
            key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), iterations)
            computed_hash = key.hex()
            return computed_hash == hash_value
            
        else:
            return False
            
    except Exception as e:
        return False

class User(db.Model):
    __tablename__ = 'Login'  # Tabellenname in der Datenbank
    id = db.Column(db.Integer, primary_key=True)
    benutzer = db.Column(db.String(80), unique=True, nullable=False)
    Passwort = db.Column(db.String(120), nullable=False)
    
    def __repr__(self):
        return f'<User {self.benutzer}>'

# Datenbank-Modell: Definiert die Struktur der Gruppen-Tabelle
class Group(db.Model):
    """
    SQLAlchemy-Modell für Gruppen.
    Jede Gruppe hat eine eindeutige ID und einen Namen.
    """
    __tablename__ = 'Gruppen'  # Tabellenname in der Datenbank
    id = db.Column(db.Integer, primary_key=True)    # Eindeutige ID (Auto-Increment)
    name = db.Column(db.String(100), nullable=False)  # Gruppenname (max. 100 Zeichen)
    art = db.Column(db.Integer, nullable=False)    # Art der Gruppe (z.B. "studenten", "auszubildende")

# Login-Endpunkt
@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            logger.error("Keine JSON-Daten empfangen")
            return jsonify({'success': False, 'message': 'JSON-Daten erforderlich'}), 400
            
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            logger.error("Username oder Password fehlt")
            return jsonify({'success': False, 'message': 'Benutzername und Passwort erforderlich'}), 400
        
        # Benutzer aus der Datenbank prüfen
        try:
            # Suche spezifischen Benutzer
            user = User.query.filter_by(benutzer=username).first()
            
            if user:
                # Teste ob es ein gültiger Werkzeug-Hash ist
                if user.Passwort.startswith(('pbkdf2:', 'scrypt:', 'argon2:')):
                    try:
                        password_valid = check_password_hash(user.Passwort, password)
                        if password_valid:
                            logger.info(f"Erfolgreiche Anmeldung: {username}")
                            return jsonify({'success': True, 'message': 'Anmeldung erfolgreich'})
                    except Exception as hash_error:
                        pass
                
                # Teste ob es ein Django-Hash ist (beginnt mit Ziffer$)
                elif user.Passwort.startswith(('1$', '2$', '3$', '4$')):
                    try:
                        # Django PBKDF2 Hash-Vergleich
                        django_valid = check_django_password(password, user.Passwort)
                        if django_valid:
                            logger.info(f"Erfolgreiche Anmeldung: {username}")
                            return jsonify({'success': True, 'message': 'Anmeldung erfolgreich'})
                    except Exception as django_error:
                        pass
                
                else:
                    # Klartext-Vergleich
                    if user.Passwort == password:
                        logger.info(f"Erfolgreiche Anmeldung: {username}")
                        return jsonify({'success': True, 'message': 'Anmeldung erfolgreich'})
            else:
                pass
            
            # Wenn wir hier ankommen, war das Login nicht erfolgreich
            logger.warning(f"Fehlgeschlagene Anmeldung: {username}")
            return jsonify({'success': False, 'message': 'Ungültige Anmeldedaten'}), 401
            
        except Exception as db_error:
            logger.error(f"Datenbankfehler bei Login: {db_error}")
            return jsonify({'success': False, 'message': f'Datenbankfehler: {str(db_error)}'}), 500
    
    except Exception as e:
        logger.error(f"Fehler bei Anmeldung: {e}")
        return jsonify({'success': False, 'message': 'Interner Serverfehler'}), 500

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
                'name': group.name,
                'art': group.art
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
    
    Expected JSON: {'name': 'Gruppenname', 'art': 1}
    
    Returns:
        JSON: {'success': True, 'message': 'Gruppe hinzugefügt'} oder Fehlermeldung
    """
    try:
        # Gruppenname und Art aus JSON-Request extrahieren
        name = request.json.get('name')  # JSON Format: {"name": "Gruppenname", "art": 1}
        art = request.json.get('art', 1)  # Default: 1 (Studenten)
        
        # Validierung: Name darf nicht leer sein
        if not name:
            return jsonify({'success': False, 'message': 'Name ist erforderlich'}), 400
        
        # Validierung: Art muss 1 oder 2 sein
        if art not in [1, 2]:
            return jsonify({'success': False, 'message': 'Art muss 1 (Studenten) oder 2 (Auszubildende) sein'}), 400
        
        # Neue Gruppe erstellen und in Datenbank speichern
        new_group = Group(name=name, art=art)
        db.session.add(new_group)
        db.session.commit()
        
        art_text = "Studenten" if art == 1 else "Auszubildende"
        logger.info(f"Neue Gruppe hinzugefügt: {name} ({art_text})")
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
@app.route('/api/login', methods=['OPTIONS'])
def options_handler(group_id=None):
    return '', 200
    
# Startet die Flask-Anwendung im Debug-Modus
if __name__ == '__main__':
    # Keine Tabellen erstellen - nutze existierende Login-Tabelle
    print("Backend startet - nutze existierende Login-Tabelle")
    
    # Debug-Modus für Entwicklung aktivieren (automatisches Neuladen bei Dateiänderungen)
    app.run(debug=True, host='127.0.0.1', port=5000)