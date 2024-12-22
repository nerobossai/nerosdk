import { MENTIONS_WINDOW, REPLY_WINDOW, TWEET_WINDOW } from "./constants";

class Counter {
  private remaining: number;
  private originalLimit: number;
  constructor(limit: number) {
    this.remaining = limit;
    this.originalLimit = limit;
  }

  public getRemaining() {
    return this.remaining;
  }

  public resetRemaining() {
    this.remaining = this.originalLimit;
  }

  public decrementRemaining() {
    this.remaining -= 1;
  }
}

export const counter = new Counter(REPLY_WINDOW);
export const priorityCounter = new Counter(REPLY_WINDOW);
export const tweetCounter = new Counter(TWEET_WINDOW);
export const hotProfilesCounter = new Counter(TWEET_WINDOW);
export const mentionsCounter = new Counter(MENTIONS_WINDOW);
export const tokenCreationCounter = new Counter(MENTIONS_WINDOW);
export const tokenSwapCounter = new Counter(MENTIONS_WINDOW);
export const tokenLendingCounter = new Counter(MENTIONS_WINDOW);
export const NFTCreationCounter = new Counter(MENTIONS_WINDOW);
