class Character:
    def __init__(self, name, hp):
        self.name = name
        self.hp = hp

    def damage(self, amount):
        self.hp = self.hp - amount

    def is_alive(self):
        return self.hp > 0


hero = Character('용사', 120)
hero.damage(50)

print(hero.name, hero.hp, hero.is_alive())
