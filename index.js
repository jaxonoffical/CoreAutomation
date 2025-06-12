const express = require("express")
const mongoose = require("mongoose")
const dotenv = require("dotenv")
const cors = require("cors")
const path = require("path")
const bcryptjs = require("bcryptjs")
const crypto = require("crypto")

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))

// MongoDB connection
mongoose
  .connect(
    "mongodb+srv://conneccore:connect.core.2025@database-core.dro9n00.mongodb.net/?retryWrites=true&w=majority&appName=database-core",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Enhanced User Schema with roles
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    trim: true,
    minlength: [3, "Username must be at least 3 characters"],
    maxlength: [20, "Username cannot exceed 20 characters"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  role: {
    type: String,
    enum: ["user", "admin", "hr_admin", "owner"],
    default: "user",
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
})

// Enhanced Bot Schema with sharing capabilities
const BotSchema = new mongoose.Schema({
  personName: {
    type: String,
    required: [true, "Person name is required"],
    trim: true,
  },
  botName: {
    type: String,
    required: [true, "Bot name is required"],
    trim: true,
  },
  serverLink: {
    type: String,
    required: [true, "Server link is required"],
    trim: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "terminated"],
    default: "active",
  },
  subscriptionType: {
    type: String,
    enum: ["hobby", "standard", "pro"],
    default: "hobby",
  },
  terminationReason: {
    type: String,
    default: "",
  },
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    permissions: {
      type: String,
      enum: ["view", "edit"],
      default: "view",
    },
    sharedAt: {
      type: Date,
      default: Date.now,
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Notification Schema
const NotificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Notification title is required"],
    trim: true,
  },
  message: {
    type: String,
    required: [true, "Notification message is required"],
    trim: true,
  },
  type: {
    type: String,
    enum: ["info", "success", "warning", "error"],
    default: "info",
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readBy: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      readAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdBy: {
    type: String,
    default: "admin",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Admin Token Schema for secure admin panel access
const AdminTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next()
  }

  try {
    const salt = await bcryptjs.genSalt(10)
    this.password = await bcryptjs.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Update bot updatedAt timestamp
BotSchema.pre("save", function (next) {
  this.updatedAt = new Date()
  next()
})

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcryptjs.compare(candidatePassword, this.password)
}

const User = mongoose.model("User", UserSchema)
const Bot = mongoose.model("Bot", BotSchema)
const Notification = mongoose.model("Notification", NotificationSchema)
const AdminToken = mongoose.model("AdminToken", AdminTokenSchema)

// Store active sessions with user data
const activeSessions = new Map()

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"))
})

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
})

// Admin panel route with token validation
app.get("/adminpanel=:token", async (req, res) => {
  try {
    const { token } = req.params
    
    // Validate token
    const adminToken = await AdminToken.findOne({ 
      token: token,
      expiresAt: { $gt: new Date() }
    }).populate('userId')
    
    if (!adminToken) {
      return res.status(401).send("Invalid or expired admin token")
    }
    
    // Check if user has admin privileges
    if (!['admin', 'hr_admin', 'owner'].includes(adminToken.userId.role)) {
      return res.status(403).send("Access denied")
    }
    
    // Serve admin panel page (you can create a separate admin.html)
    res.sendFile(path.join(__dirname, "public", "dashboard.html"))
  } catch (error) {
    res.status(500).send("Server error")
  }
})

// Generate admin token endpoint
app.post("/api/admin/generate-token", async (req, res) => {
  try {
    const { sessionToken } = req.body
    
    if (!sessionToken || !activeSessions.has(sessionToken)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }
    
    const sessionData = activeSessions.get(sessionToken)
    const user = await User.findById(sessionData.userId)
    
    if (!user || !['admin', 'hr_admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }
    
    // Generate secure token
    const token = crypto.randomBytes(20).toString('hex').substring(0, 27)
    
    // Save token with 1 hour expiration
    await AdminToken.create({
      token: token,
      userId: user._id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    })
    
    res.json({
      success: true,
      token: token,
      adminUrl: `/adminpanel=${token}`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred",
    })
  }
})

// Enhanced User management endpoints
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 })
    res.json({
      success: true,
      data: users,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching users",
    })
  }
})

app.post("/api/admin/users", async (req, res) => {
  try {
    const { username, password, email, role } = req.body

    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      })
    }

    const user = await User.create({
      username,
      password,
      email,
      role: role || "user",
    })

    // Create welcome notification for the new user
    await Notification.create({
      title: "Welcome to Core Dashboard",
      message: "Welcome to the Core Dashboard. This is where you can manage your bot operations professionally.",
      type: "info",
      targetUser: user._id,
      createdBy: "admin",
    })

    console.log(`Created welcome notification for admin-created user: ${username}`)

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        username: user.username,
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred during user creation",
    })
  }
})

app.put("/api/admin/users/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { username, email, role, status, password } = req.body

    const updateData = {
      username,
      email,
      role,
      status,
    }

    // Only update password if provided
    if (password && password.trim() !== "") {
      const salt = await bcryptjs.genSalt(10)
      updateData.password = await bcryptjs.hash(password, salt)
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true, select: "-password" })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while updating user",
    })
  }
})

app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const { id } = req.params

    // Also delete all bots associated with this user
    await Bot.deleteMany({ userId: id })

    const user = await User.findByIdAndDelete(id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      message: "User and associated bots deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while deleting user",
    })
  }
})

// Enhanced Bot management endpoints with sharing
app.post("/api/bots/register", async (req, res) => {
  try {
    const { sessionToken, personName, botName, serverLink } = req.body

    if (!sessionToken || !activeSessions.has(sessionToken)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }

    const sessionData = activeSessions.get(sessionToken)

    const bot = await Bot.create({
      personName,
      botName,
      serverLink,
      userId: sessionData.userId,
    })

    res.status(201).json({
      success: true,
      message: "Bot registered successfully",
      data: bot,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred during bot registration",
    })
  }
})

app.post("/api/admin/bots", async (req, res) => {
  try {
    const { personName, botName, serverLink, userId, subscriptionType } = req.body

    const bot = await Bot.create({
      personName,
      botName,
      serverLink,
      userId,
      subscriptionType: subscriptionType || "hobby",
    })

    const populatedBot = await Bot.findById(bot._id).populate("userId", "username")

    res.status(201).json({
      success: true,
      message: "Bot created successfully",
      data: populatedBot,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred during bot creation",
    })
  }
})

app.get("/api/bots", async (req, res) => {
  try {
    const bots = await Bot.find().populate("userId", "username").sort({ createdAt: -1 })

    res.json({
      success: true,
      data: bots,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching bots",
    })
  }
})

app.get("/api/bots/user/:sessionToken", async (req, res) => {
  try {
    const { sessionToken } = req.params

    if (!sessionToken || !activeSessions.has(sessionToken)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }

    const sessionData = activeSessions.get(sessionToken)
    
    // Get bots owned by user and bots shared with user
    const ownedBots = await Bot.find({ userId: sessionData.userId }).sort({ createdAt: -1 })
    const sharedBots = await Bot.find({ 
      "sharedWith.userId": sessionData.userId 
    }).populate("userId", "username").sort({ createdAt: -1 })

    res.json({
      success: true,
      data: ownedBots,
      sharedBots: sharedBots,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching user bots",
    })
  }
})

// Bot sharing endpoints
app.post("/api/bots/:id/share", async (req, res) => {
  try {
    const { id } = req.params
    const { sessionToken, targetUserId, permissions } = req.body

    if (!sessionToken || !activeSessions.has(sessionToken)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }

    const sessionData = activeSessions.get(sessionToken)
    const user = await User.findById(sessionData.userId)

    const bot = await Bot.findById(id)
    if (!bot) {
      return res.status(404).json({
        success: false,
        message: "Bot not found",
      })
    }

    // Check if user is owner or has admin privileges
    const canShare = bot.userId.toString() === sessionData.userId.toString() || 
                    ['owner', 'hr_admin'].includes(user.role)

    if (!canShare) {
      return res.status(403).json({
        success: false,
        message: "Only the owner or HR admin can share bots",
      })
    }

    // Check if already shared with this user
    const existingShare = bot.sharedWith.find(share => 
      share.userId.toString() === targetUserId.toString()
    )

    if (existingShare) {
      return res.status(400).json({
        success: false,
        message: "Bot is already shared with this user",
      })
    }

    // Add to shared list
    bot.sharedWith.push({
      userId: targetUserId,
      permissions: permissions || "view",
      sharedBy: sessionData.userId,
    })

    await bot.save()

    res.json({
      success: true,
      message: "Bot shared successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while sharing bot",
    })
  }
})

app.delete("/api/bots/:id/share/:userId", async (req, res) => {
  try {
    const { id, userId } = req.params
    const { sessionToken } = req.body

    if (!sessionToken || !activeSessions.has(sessionToken)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }

    const sessionData = activeSessions.get(sessionToken)
    const user = await User.findById(sessionData.userId)

    const bot = await Bot.findById(id)
    if (!bot) {
      return res.status(404).json({
        success: false,
        message: "Bot not found",
      })
    }

    // Check if user is owner or has admin privileges
    const canUnshare = bot.userId.toString() === sessionData.userId.toString() || 
                      ['owner', 'hr_admin'].includes(user.role)

    if (!canUnshare) {
      return res.status(403).json({
        success: false,
        message: "Only the owner or HR admin can unshare bots",
      })
    }

    // Remove from shared list
    bot.sharedWith = bot.sharedWith.filter(share => 
      share.userId.toString() !== userId.toString()
    )

    await bot.save()

    res.json({
      success: true,
      message: "Bot unshared successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while unsharing bot",
    })
  }
})

app.put("/api/bots/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { personName, botName, serverLink, subscriptionType, status, terminationReason } = req.body

    const updateData = {
      personName,
      botName,
      serverLink,
      status,
      updatedAt: new Date(),
    }

    // Update subscription type if provided
    if (subscriptionType) {
      updateData.subscriptionType = subscriptionType
    }

    // Update termination reason if status is terminated
    if (status === "terminated") {
      updateData.terminationReason = terminationReason || ""
    } else if (status === "active") {
      // Clear termination reason if bot is reactivated
      updateData.terminationReason = ""
    }

    const bot = await Bot.findByIdAndUpdate(id, updateData, { new: true }).populate("userId", "username")

    if (!bot) {
      return res.status(404).json({
        success: false,
        message: "Bot not found",
      })
    }

    res.json({
      success: true,
      message: "Bot updated successfully",
      data: bot,
    })
  } catch (error) {
    console.error("Bot update error:", error)
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while updating bot",
    })
  }
})

app.delete("/api/bots/:id", async (req, res) => {
  try {
    const { id } = req.params

    const bot = await Bot.findByIdAndDelete(id)

    if (!bot) {
      return res.status(404).json({
        success: false,
        message: "Bot not found",
      })
    }

    res.json({
      success: true,
      message: "Bot deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while deleting bot",
    })
  }
})

// Enhanced Notification endpoints
app.post("/api/notifications", async (req, res) => {
  try {
    const { title, message, type, targetUser } = req.body

    const notification = await Notification.create({
      title,
      message,
      type,
      targetUser: targetUser || null,
    })

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while creating notification",
    })
  }
})

app.get("/api/notifications/user/:sessionToken", async (req, res) => {
  try {
    const { sessionToken } = req.params

    if (!sessionToken || !activeSessions.has(sessionToken)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }

    const sessionData = activeSessions.get(sessionToken)

    // Get notifications for this user and broadcast notifications
    const notifications = await Notification.find({
      $or: [{ targetUser: sessionData.userId }, { targetUser: null }],
    }).sort({ createdAt: -1 })

    // Mark notifications as read for this user
    const notificationsWithReadStatus = notifications.map((notification) => {
      const isReadByUser = notification.readBy.some((read) => read.userId.toString() === sessionData.userId.toString())

      return {
        ...notification.toObject(),
        isRead: isReadByUser,
      }
    })

    res.json({
      success: true,
      data: notificationsWithReadStatus,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching notifications",
    })
  }
})

app.put("/api/notifications/mark-all-read/:sessionToken", async (req, res) => {
  try {
    const { sessionToken } = req.params

    if (!sessionToken || !activeSessions.has(sessionToken)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }

    const sessionData = activeSessions.get(sessionToken)

    // Get all notifications for this user
    const notifications = await Notification.find({
      $or: [{ targetUser: sessionData.userId }, { targetUser: null }],
    })

    // Mark all as read for this user
    for (const notification of notifications) {
      const alreadyRead = notification.readBy.some((read) => read.userId.toString() === sessionData.userId.toString())

      if (!alreadyRead) {
        notification.readBy.push({
          userId: sessionData.userId,
          readAt: new Date(),
        })
        await notification.save()
      }
    }

    res.json({
      success: true,
      message: "All notifications marked as read",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while marking notifications as read",
    })
  }
})

// Authentication endpoints
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body

    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Username already exists" })
    }

    const user = await User.create({
      username,
      password,
    })

    // Create welcome notification for the new user
    await Notification.create({
      title: "Welcome to Core Dashboard",
      message: "Welcome to the Core Dashboard. This is where you can manage your bot operations professionally.",
      type: "info",
      targetUser: user._id,
      createdBy: "system",
    })

    console.log(`Created welcome notification for new user: ${username}`)

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { username: user.username, id: user._id },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred during registration",
    })
  }
})

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body

    const user = await User.findOne({ username })
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" })
    }

    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    activeSessions.set(sessionToken, {
      userId: user._id,
      username: user.username,
      role: user.role,
      loginTime: Date.now(),
    })

    user.lastLogin = Date.now()
    await user.save()

    console.log(`User ${username} logged in with session ${sessionToken}`)

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        username: user.username,
        id: user._id,
        role: user.role,
        sessionToken: sessionToken,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred during login",
    })
  }
})

app.post("/api/auth/logout", (req, res) => {
  const { sessionToken } = req.body

  if (sessionToken && activeSessions.has(sessionToken)) {
    const sessionData = activeSessions.get(sessionToken)
    console.log(`User ${sessionData.username} logged out`)
    activeSessions.delete(sessionToken)
  }

  res.json({
    success: true,
    message: "Logged out successfully",
  })
})

app.post("/api/auth/verify", async (req, res) => {
  const { sessionToken } = req.body

  if (!sessionToken || !activeSessions.has(sessionToken)) {
    return res.status(401).json({
      success: false,
      message: "Invalid session",
    })
  }

  const sessionData = activeSessions.get(sessionToken)

  try {
    // Get user data including creation date and role
    const user = await User.findById(sessionData.userId).select("username createdAt role")

    res.json({
      success: true,
      message: "Session valid",
      data: {
        username: sessionData.username,
        userId: sessionData.userId,
        createdAt: user.createdAt,
        role: user.role,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying session",
    })
  }
})

// Clear all sessions on startup
activeSessions.clear()
console.log("All sessions cleared on startup")

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
  console.log("Dashboard authentication system is active")
  console.log("Admin panel system is ready")
})