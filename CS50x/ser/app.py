from cs50 import SQL
from flask import Flask, render_template, redirect, request

app = Flask(__name__)

REGISTRANTS = {}

SPORTS = [
        "Basketball",
        "Football",
        "Cricket"
]

@app.route("/")
def index():
        return render_template("index.html", sports=SPORTS)

@app.route("/register", methods=["POST"])
def register():
        name=request.form.get("name")
        if not name:
                return render_template("error.html", message="Missing name")
        sport=request.form.get("sport")
        if not sport:
                return render_template("error.html", message="Missing sport")

        REGISTRANTS[name]=sport
        return redirect("/registrants")

@app.route("/registrants")
def registrants():
        return render_template("registrants.html", registrants=REGISTRANTS)
