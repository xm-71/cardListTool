import { Component, VERSION } from "@angular/core";
import axios from "axios";

@Component({
  selector: "my-app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  pokeList: any;

  ngOnInit() {
    this.getPokeData();
  }

  getPokeData() {
    axios.get("https://api.pokemontcg.io/v2/cards").then(res => {
      this.pokeList = res.data.data;
      console.log(res.data.data);
    });
  }
}
