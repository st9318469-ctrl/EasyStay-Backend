import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: Date,
    attachments: [{
        type: String,
        url: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Message', messageSchema);