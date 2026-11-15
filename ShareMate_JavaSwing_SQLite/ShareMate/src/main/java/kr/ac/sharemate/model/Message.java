package kr.ac.sharemate.model;

public class Message {
    public final int id, itemId;
    public final boolean mine;
    public final String content, sentAt;
    public Message(int id, int itemId, boolean mine, String content, String sentAt) {
        this.id=id; this.itemId=itemId; this.mine=mine; this.content=content; this.sentAt=sentAt;
    }
}
