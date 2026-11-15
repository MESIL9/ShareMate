package kr.ac.sharemate.model;

public class Item {
    public int id;
    public boolean rent, favorite;
    public String title, category, description, want, tags, imagePath, owner, location, createdAt;
    public int price, deposit, views;

    public Item(int id, boolean rent, String title, String category, String description,
                String want, String tags, String imagePath, String owner, String location,
                int price, int deposit, int views, boolean favorite, String createdAt) {
        this.id=id; this.rent=rent; this.title=title; this.category=category; this.description=description;
        this.want=want; this.tags=tags; this.imagePath=imagePath; this.owner=owner; this.location=location;
        this.price=price; this.deposit=deposit; this.views=views; this.favorite=favorite; this.createdAt=createdAt;
    }
}
