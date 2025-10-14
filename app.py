import os
from flask import Flask, render_template, redirect, url_for, request, session, flash
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Length

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-key-change-me")

# ---- Simple fake auth (Phase 1). Replace with real DB later.
USERS = {"demo@betterhunt.app": {"password": "demo", "first_name": "Demo", "last_name": "User"}}

class LoginForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired()])
    password = PasswordField("Password", validators=[DataRequired()])
    submit = SubmitField("Log In")

class RegisterForm(FlaskForm):
    first_name = StringField("First Name", validators=[DataRequired(), Length(min=1, max=50)])
    last_name = StringField("Last Name", validators=[DataRequired(), Length(min=1, max=50)])
    email = StringField("Email", validators=[DataRequired()])
    password = PasswordField("Password", validators=[DataRequired(), Length(min=3)])
    submit = SubmitField("Create Account")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/map")
def map_view():
    # Example: seed a couple of fake properties (GeoJSON-ish dicts)
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
            "notes": "Open for archery; no firearms Nov 10-20.",
            "coords": [
                [38.8895, -99.3362],
                [38.8907, -99.3331],
                [38.8883, -99.3315],
                [38.8872, -99.3349]
            ]
        }
    ]
    return render_template("map.html", properties=example_properties)

@app.route("/login", methods=["GET", "POST"])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        pw = form.password.data
        user = USERS.get(email)
        if user and user["password"] == pw:
            session["user"] = {"email": email, "first_name": user["first_name"], "last_name": user["last_name"]}
            flash("Welcome back!", "success")
            return redirect(url_for("map_view"))
        flash("Invalid credentials.", "danger")
    return render_template("login.html", form=form)

@app.route("/register", methods=["GET", "POST"])
def register():
    form = RegisterForm()
    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        if email in USERS:
            flash("Account already exists.", "warning")
        else:
            USERS[email] = {
                "password": form.password.data,
                "first_name": form.first_name.data.strip(),
                "last_name": form.last_name.data.strip(),
            }
            flash("Account created. You can log in now.", "success")
            return redirect(url_for("login"))
    return render_template("register.html", form=form)

@app.route("/logout")
def logout():
    session.clear()
    flash("Signed out.", "info")
    return redirect(url_for("index"))

if __name__ == "__main__":
    app.run(debug=True)
