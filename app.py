import os
import json
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, redirect, url_for, request, flash, jsonify
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Length, Email
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from flask import request, jsonify, render_template
from utils.weather import get_weather, geocode_place
from flask_login import (
    LoginManager, login_user, login_required,
    logout_user, current_user, UserMixin
)

# ---------------- Setup ----------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'betterhunt.db')

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-key-change-me')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'


# ---------------- Models ----------------
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(60), nullable=False)
    last_name = db.Column(db.String(60), nullable=False)

    def set_password(self, pw: str):
        self.password_hash = generate_password_hash(pw)

    def check_password(self, pw: str) -> bool:
        return check_password_hash(self.password_hash, pw)


class Waypoint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    label = db.Column(db.String(120), default='Waypoint')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Boundary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), index=True, nullable=False)
    name = db.Column(db.String(120), default='Custom Boundary')
    coords_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ---------------- Forms ----------------
class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Log In')


class RegisterForm(FlaskForm):
    first_name = StringField('First Name', validators=[DataRequired(), Length(min=1, max=50)])
    last_name = StringField('Last Name', validators=[DataRequired(), Length(min=1, max=50)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=3)])
    submit = SubmitField('Create Account')


# ---------------- Routes ----------------
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/map')
@login_required
def map_view():
    # Example demo properties
    example_properties = [
        {
            "name": "Miller Ranch North",
            "notes": "Ask permission before entering.",
            "coords": [
                [38.8849, -99.3281],
                [38.8858, -99.3251],
                [38.8836, -99.3239],
                [38.8825, -99.3276]
            ]
        },
        {
            "name": "State Land Unit 7-D",
            "notes": "Archery only Nov 10–20.",
            "coords": [
                [38.8895, -99.3362],
                [38.8907, -99.3331],
                [38.8883, -99.3315],
                [38.8872, -99.3349]
            ]
        }
    ]
    return render_template('map.html', properties=example_properties)

@app.route('/seasons')
def seasons():
    data_path = Path(__file__).with_name('data') / 'seasons_ks.json'
    seasons = []
    if data_path.exists():
        with open(data_path, 'r', encoding='utf-8') as f:
            seasons = json.load(f)
    return render_template('seasons.html', seasons=seasons)

@app.route('/weather')
def weather_page():
    return render_template('weather.html')

@app.route('/api/weather')
def weather_api():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    q = request.args.get('q')

    if not (lat and lon):
        if not q:
            return jsonify({'error': 'Provide lat/lon or q'}), 400
        geo = geocode_place(q)
        if not geo:
            return jsonify({'error': 'Location not found'}), 404
        lat, lon, name = geo['lat'], geo['lon'], geo['name']
    else:
        name = None

    data = get_weather(lat, lon)
    if 'error' in data:
        return jsonify(data), 502
    if name:
        data['resolved_name'] = name
    return jsonify(data)

@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data.strip().lower()).first()
        if user and user.check_password(form.password.data):
            login_user(user)
            flash('Welcome back!', 'success')
            return redirect(url_for('map_view'))
        flash('Invalid credentials.', 'danger')
    return render_template('login.html', form=form)


@app.route('/register', methods=['GET', 'POST'])
def register():
    form = RegisterForm()
    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        if User.query.filter_by(email=email).first():
            flash('Account already exists.', 'warning')
        else:
            u = User(
                email=email,
                first_name=form.first_name.data.strip(),
                last_name=form.last_name.data.strip()
            )
            u.set_password(form.password.data)
            db.session.add(u)
            db.session.commit()
            flash('Account created. You can log in now.', 'success')
            return redirect(url_for('login'))
    return render_template('register.html', form=form)


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Signed out.', 'info')
    return redirect(url_for('index'))


# ---------------- API Routes ----------------
@app.post('/api/waypoints')
@login_required
def api_add_waypoint():
    data = request.get_json(force=True)
    lat = float(data.get('lat'))
    lng = float(data.get('lng'))
    label = (data.get('label') or 'Waypoint')[:120]
    w = Waypoint(user_id=current_user.id, lat=lat, lng=lng, label=label)
    db.session.add(w)
    db.session.commit()
    return jsonify({'ok': True, 'id': w.id}), 201


@app.get('/api/boundaries')
@login_required
def api_get_boundaries():
    import json as _json
    polys = Boundary.query.filter_by(user_id=current_user.id).order_by(Boundary.created_at.desc()).all()
    out = []
    for b in polys:
        out.append({
            'id': b.id,
            'name': b.name,
            'coords': _json.loads(b.coords_json),
            'created_at': b.created_at.isoformat()
        })
    return jsonify(out)


@app.post('/api/boundaries')
@login_required
def api_add_boundary():
    import json as _json
    data = request.get_json(force=True)
    name = (data.get('name') or 'Custom Boundary')[:120]
    coords = data.get('coords') or []
    if len(coords) < 3:
        return jsonify({'ok': False, 'error': 'Need at least 3 points'}), 400
    b = Boundary(user_id=current_user.id, name=name, coords_json=_json.dumps(coords))
    db.session.add(b)
    db.session.commit()
    return jsonify({'ok': True, 'id': b.id}), 201


# ---------------- CLI Helper ----------------
@app.cli.command('init-db')
def init_db_command():
    """Create tables and seed a demo user."""
    db.create_all()
    if not User.query.filter_by(email='demo@betterhunt.app').first():
        u = User(email='demo@betterhunt.app', first_name='Demo', last_name='User')
        u.set_password('demo')
        db.session.add(u)
        db.session.commit()
    print('Database initialized at', DB_PATH)


# ---------------- Run ----------------
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
