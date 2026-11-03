import { AccessLinks } from "./access-links";
import { db } from "./db/client";
import { createImageStore, ImageService } from "./images";
import { PushService } from "./push";
import { RecipeService } from "./recipes/service";
import { UserService } from "./users";

export const services = {
  recipes: new RecipeService(db),
  images: new ImageService(db, createImageStore()),
  push: new PushService(db),
  links: new AccessLinks(db),
  users: new UserService(db),
};

export type Services = typeof services;
