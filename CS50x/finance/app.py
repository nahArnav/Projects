import os

from cs50 import SQL
from flask import Flask, flash, redirect, render_template, request, session
from flask_session import Session
from werkzeug.security import check_password_hash, generate_password_hash

from helpers import apology, login_required, lookup, usd

# Configure application
app = Flask(__name__)

# Custom filter
app.jinja_env.filters["usd"] = usd

# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

# Configure CS50 Library to use SQLite database
db = SQL("sqlite:///finance.db")


@app.after_request
def after_request(response):
    """Ensure responses aren't cached"""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response


@app.route("/")
@login_required
def index():
    """Show portfolio of stocks"""
    user_id = session["user_id"]
    user_cash = db.execute("SELECT cash FROM users WHERE id = ?", user_id)
    cash = user_cash[0]["cash"]
    stocks = db.execute("SELECT share_symbol as symbol, SUM(CASE WHEN transaction_type = 'BUY' THEN share_num ELSE -share_num END) as total_shares, SUM(CASE WHEN transaction_type = 'BUY' THEN share_price * share_num ELSE 0 END) / SUM(CASE WHEN transaction_type = 'BUY' THEN share_num ELSE 0 END) as avg_buy_price FROM transaction_logs WHERE user_id = ? GROUP BY symbol HAVING total_shares>0", user_id)

    total = cash
    for stock in stocks:
        stock_info = lookup(stock["symbol"])

        stock["name"] = stock_info["name"]
        stock["live_price"] = stock_info["price"]
        stock["total_value"] = stock_info["price"] * stock["total_shares"]
        total += stock["total_value"]

    return render_template("portfolio.html", stocks=stocks, cash=cash, total=total)


@app.route("/history")
@login_required
def history():
    """Show history of transactions"""
    transaction_history = db.execute(
        " SELECT share_symbol, share_num, transaction_type, share_price, transaction_time FROM transaction_logs WHERE user_id = ? ORDER BY transaction_time DESC ", session["user_id"])
    return render_template("history.html", transactions=transaction_history)


@app.route("/login", methods=["GET", "POST"])
def login():
    """Log user in"""

    # Forget any user_id
    session.clear()

    # User reached route via POST (as by submitting a form via POST)
    if request.method == "POST":
        # Ensure username was submitted
        if not request.form.get("username"):
            return apology("must provide username", 403)

        # Ensure password was submitted
        elif not request.form.get("password"):
            return apology("must provide password", 403)

        # Query database for username
        rows = db.execute(
            "SELECT * FROM users WHERE username = ?", request.form.get("username")
        )

        # Ensure username exists and password is correct
        if len(rows) != 1 or not check_password_hash(
            rows[0]["hash"], request.form.get("password")
        ):
            return apology("invalid username and/or password", 403)

        # Remember which user has logged in
        session["user_id"] = rows[0]["id"]

        # Redirect user to home page
        return redirect("/")

    # User reached route via GET (as by clicking a link or via redirect)
    else:
        return render_template("login.html")


@app.route("/logout")
def logout():
    """Log user out"""

    # Forget any user_id
    session.clear()

    # Redirect user to login form
    return redirect("/")


@app.route("/quote", methods=["GET", "POST"])
@login_required
def quote():
    if request.method == "POST":
        a = lookup(request.form.get("symbol"))
        #check all edge cases
        if not request.form.get("symbol"):
            return apology("Must provide symbol", 400)
        elif a == None:
            return apology("No stock corresponding to this symbol", 400)
        return render_template("result.html", name=a["name"], price=usd(a["price"]), symbol=a["symbol"])
    else:
        return render_template("quote.html")


@app.route("/sell", methods=["GET", "POST"])
@login_required
def sell():
    """Sell shares of stock"""
    if request.method == "POST":
        user_id = session["user_id"]
        symbol_input = request.form.get("symbol")
        #check all edge cases
        if not symbol_input:
            return apology("Must provide a symbol", 400)
        a = lookup(symbol_input)
        if a == None:
            return apology("Invalid stock symbol", 400)
        symbol = a["symbol"]
        stock_price = a["price"]
        shares = request.form.get("shares")
        if not shares or not shares.isdigit():
            return apology("Shares must be a positive whole number", 400)
        number = int(shares)
        if number < 1:
            return apology("No. of Shares should be at least 1", 400)
        numstocks = db.execute(
            "SELECT SUM(CASE WHEN transaction_type = 'BUY' THEN share_num ELSE -share_num END) as total_shares FROM transaction_logs WHERE user_id = ? AND share_symbol = ? GROUP BY share_symbol", user_id, symbol)
        if not numstocks or numstocks[0]["total_shares"] < number:
            return apology("You don't own that many shares", 400)
        total = stock_price * number
        db.execute("UPDATE users SET cash = cash + ? WHERE id = ?", total, user_id)
        db.execute("INSERT INTO transaction_logs (user_id, share_symbol, share_price, share_num, transaction_type) VALUES (?, ?, ?, ?, 'SELL')",
                   user_id, symbol, stock_price, number)

        return redirect("/")

    else:
        stocks = db.execute(
            "SELECT share_symbol FROM transaction_logs WHERE user_id = ? GROUP BY share_symbol HAVING SUM(CASE WHEN transaction_type = 'BUY' THEN share_num ELSE -share_num END) > 0", session["user_id"])
        return render_template("sell.html", stocks=stocks)


@app.route("/buy", methods=["GET", "POST"])
@login_required
def buy():
    """Buy shares of stock"""
    user_id = session["user_id"]
    if request.method == "POST":
        inputsymbol = request.form.get("symbol")
        #check all edge cases
        if not inputsymbol:
            return apology("Must provide a symbol", 400)

        a = lookup(inputsymbol)
        if a is None:
            return apology("Invalid stock symbol", 400)

        symbol = a["symbol"]
        stock_price = a["price"]

        shares = request.form.get("shares")
        if not shares or not shares.isdigit():
            return apology("Shares must be a positive whole number", 400)

        number = int(shares)
        if number < 1:
            return apology("Must buy at least 1 share", 400)

        stock_price = a["price"]
        user_cash = db.execute("SELECT cash FROM users WHERE id = ?", user_id)
        cash = user_cash[0]["cash"]
        total = stock_price*number

        if (total > cash):
            return apology("Insufficient Funds", 400)
        db.execute("UPDATE users SET cash = cash - ? WHERE id = ?", total, user_id)
        db.execute("INSERT INTO transaction_logs (user_id, share_symbol, share_price, share_num, transaction_type) VALUES (?, ?, ?, ?, 'BUY')",
                   user_id, symbol, stock_price, shares)
        return redirect("/")
    else:
        return render_template("buy.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        #check all edge cases
        if not request.form.get("username"):
            return apology("must provide username", 400)
        elif not request.form.get("password"):
            return apology("must provide password", 400)
        elif not request.form.get("confirmation"):
            return apology("must provide confirmed password", 400)
        elif not (request.form.get("password") == request.form.get("confirmation")):
            return apology("passwords must match", 400)
        existing_user = db.execute("SELECT * FROM users WHERE username = ?",
                                   request.form.get("username"))
        if len(existing_user) > 0:
            return apology("Username already taken", 400)

        db.execute("INSERT INTO users (username, hash) VALUES (?)", (request.form.get(
            "username"), generate_password_hash(request.form.get("password"))))
        return render_template("login.html")
    else:
        return render_template("register.html")
